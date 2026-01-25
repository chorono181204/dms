import React, { useState, useEffect, useRef } from 'react';
import { Input, List, Avatar, Typography, Badge, Space, Button, Divider, Tooltip, Upload, UploadFile, message as antdMessage, Image, Modal } from 'antd';
import { SearchOutlined, PaperClipOutlined, MoreOutlined, UserOutlined, LoadingOutlined, FileTextOutlined, DownloadOutlined } from '@ant-design/icons';
import './Chat.css';
import * as chatService from '../api/services/chat.service';
import * as userService from '../api/services/user.service';
import { socketService } from '../api/services/socket.service';
import dayjs from 'dayjs';
import { useAuth } from '../contexts/AuthContext';

const { Text, Title } = Typography;


const ChatPage: React.FC = () => {
    const { user: currentUser } = useAuth();
    const [conversations, setConversations] = useState<any[]>([]);
    const [selectedConv, setSelectedConv] = useState<any>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [searchText, setSearchText] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [pendingFiles, setPendingFiles] = useState<UploadFile[]>([]);
    const historyRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadConversations(); // Initial load

        // Connect socket
        socketService.connect();

        // Listen for new messages
        const handleChatPageMessage = (message: any) => {
            // Update messages list if viewing this conversation
            if (selectedConv && message.conversationId === selectedConv.id) {
                setMessages((prev) => [...prev, message]);
            }
            // Always refresh conversation list to show new message preview/unread
            loadConversations();
        };

        socketService.onReceiveMessage(handleChatPageMessage);

        return () => {
            socketService.offReceiveMessage(handleChatPageMessage);
        };
    }, [selectedConv]); // Re-bind listener when selectedConv changes to access current state? 
    // Actually, state inside callback might be stale if we don't use functional updates or ref.
    // 'setMessages' with callback is safe. 'selectedConv' dependency is needed or use a Ref.
    // Better pattern: dependency array [selectedConv].

    const loadConversations = async () => {
        try {
            const data = await chatService.getConversations();
            setConversations(data);
            if (data.length > 0 && !selectedConv) {
                setSelectedConv(data[0]);
            }
        } catch (error) {
            antdMessage.error('Không thể tải danh sách hội thoại');
        }
    };

    useEffect(() => {
        if (selectedConv) {
            loadMessages(selectedConv.id);
        }
    }, [selectedConv]);

    const loadMessages = async (convId: number) => {
        try {
            const data = await chatService.getMessages(convId);
            setMessages(data.results);
        } catch (error) {
            antdMessage.error('Không thể tải lịch sử tin nhắn');
        }
    };

    // Debounced search effect
    useEffect(() => {
        if (!searchText.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        // Keep old results visible while searching -> Don't clear searchResults here

        const timer = setTimeout(async () => {
            try {
                const data = await userService.searchUsers(searchText);
                setSearchResults(data.results.filter((u: any) => u.id !== currentUser?.id));
            } catch (error) {
                console.error('Search failed', error);
            } finally {
                setIsSearching(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchText, currentUser?.id]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchText(e.target.value);
        if (e.target.value.trim()) {
            setIsSearching(true);
        } else {
            setIsSearching(false);
        }
    };

    const handleStartChat = async (otherUser: any) => {
        // Optimistic UI update: Close search immediately
        setSearchText('');
        setSearchResults([]);
        setIsSearching(false);

        try {
            const conversation = await chatService.getOrCreateConversation(otherUser.id);
            // Refresh conversations list to include the new one
            await loadConversations();
            setSelectedConv({ ...conversation, otherUser });
        } catch (error) {
            antdMessage.error('Không thể bắt đầu trò chuyện');
        }
    };

    useEffect(() => {
        if (historyRef.current) {
            historyRef.current.scrollTop = historyRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSendMessage = async () => {
        if (!inputValue.trim() && pendingFiles.length === 0) return;
        if (!selectedConv) return;

        console.log('[CHAT] Sending message with files:', pendingFiles.length);

        const formData = new FormData();
        formData.append('conversationId', selectedConv.id.toString());
        if (inputValue.trim()) formData.append('text', inputValue);

        pendingFiles.forEach((file, index) => {
            console.log(`[CHAT] Appending file ${index}:`, file.name, file.originFileObj);
            if (file.originFileObj) {
                formData.append('files', file.originFileObj as File);
            } else {
                console.error('[CHAT] Missing originFileObj for file:', file.name);
            }
        });

        console.log('[CHAT] FormData entries:');
        for (let pair of (formData as any).entries()) {
            console.log(pair[0], pair[1]);
        }

        try {
            console.log('[CHAT] Calling chatService.sendMessage...');
            const sentMsg = await chatService.sendMessage(formData);
            console.log('[CHAT] Message sent successfully:', sentMsg);
            setMessages([...messages, sentMsg]);
            setInputValue('');
            setPendingFiles([]);
            loadConversations(); // Update last message in list
        } catch (error: any) {
            console.error('[CHAT] Send message error:', error);
            console.error('[CHAT] Error response:', error.response?.data);
            antdMessage.error('Không thể gửi tin nhắn');
        }
    };

    const renderAttachments = (msg: any) => {
        if (!msg.attachments || msg.attachments.length === 0) return null;

        const images = msg.attachments.filter((att: any) => att.fileType.startsWith('image/'));
        const files = msg.attachments.filter((att: any) => !att.fileType.startsWith('image/'));

        return (
            <div style={{ background: 'transparent', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'inherit' }}>
                {/* Images Grid */}
                {images.length > 0 && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: images.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(120px, 1fr))',
                        gap: 4,
                        marginBottom: files.length > 0 ? 8 : 0,
                        maxWidth: '300px'
                    }}>
                        <Image.PreviewGroup>
                            {images.map((att: any, idx: number) => {
                                const isSingleImage = images.length === 1;

                                if (idx >= 4) return (
                                    <Image
                                        key={idx}
                                        src={`/api/v1/upload/view?path=${encodeURIComponent(att.filePath)}`}
                                        style={{ display: 'none' }}
                                    />
                                );

                                return (
                                    <div key={idx} style={{
                                        position: 'relative',
                                        aspectRatio: isSingleImage ? 'auto' : '1/1',
                                        overflow: 'hidden',
                                        borderRadius: 16,
                                        boxShadow: isSingleImage ? 'none' : '0 2px 8px rgba(0,0,0,0.1)',
                                        display: 'flex',
                                        justifyContent: msg.senderId === currentUser?.id ? 'flex-end' : 'flex-start'
                                    }}>
                                        <Image
                                            src={`/api/v1/upload/view?path=${encodeURIComponent(att.filePath)}`}
                                            style={{
                                                width: '100%',
                                                height: 'auto',
                                                maxHeight: '400px',
                                                objectFit: isSingleImage ? 'contain' : 'cover',
                                                borderRadius: 16,
                                                boxShadow: isSingleImage ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'
                                            }}
                                            alt={att.fileName}
                                        />
                                        {idx === 3 && images.length > 4 && (
                                            <div style={{
                                                position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
                                                display: 'flex', justifyContent: 'center', alignItems: 'center',
                                                color: '#fff', fontSize: 20, fontWeight: 'bold', pointerEvents: 'none'
                                            }}>
                                                +{images.length - 4}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </Image.PreviewGroup>
                    </div>
                )}

                {/* Files List */}
                {files.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: images.length > 0 ? 8 : 0 }}>
                        {files.map((att: any, idx: number) => (
                            <div key={idx} style={{
                                background: '#fff',
                                border: '1px solid #e8e8e8',
                                padding: '10px 14px',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                maxWidth: '280px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                            }}
                                className="file-attachment-card"
                                onClick={() => {
                                    const link = document.createElement('a');
                                    link.href = `/api/v1/upload/download?path=${encodeURIComponent(att.filePath)}`;
                                    link.download = att.fileName;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                }}>
                                <div style={{
                                    width: 36, height: 36, background: '#f5f5f5',
                                    borderRadius: 8, display: 'flex', justifyContent: 'center', alignItems: 'center'
                                }}>
                                    <FileTextOutlined style={{ fontSize: 20, color: '#1677ff' }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <Text ellipsis style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#262626' }}>
                                        {att.fileName}
                                    </Text>
                                    <Text style={{ color: '#8c8c8c', fontSize: 11 }}>
                                        {(att.fileSize / 1024).toFixed(1)} KB
                                    </Text>
                                </div>
                                <DownloadOutlined style={{ color: '#bfbfbf', fontSize: 16 }} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="chat-container">
            {/* Sidebar: Conversation List */}
            <div className="chat-sidebar">
                <div style={{ padding: '16px', borderBottom: '1px solid #f0f0f0', position: 'relative' }}>
                    <Title level={4} style={{ margin: '0 0 16px 0' }}>Tin nhắn</Title>
                    <Input
                        prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                        suffix={isSearching ? <LoadingOutlined style={{ color: '#1890ff' }} /> : null}
                        placeholder="Tìm kiếm người dùng..."
                        style={{ borderRadius: '6px' }}
                        value={searchText}
                        onChange={handleSearchChange}
                    />

                    {/* Search Results Overlay */}
                    {searchText.trim() && (searchResults.length > 0 || isSearching) && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            zIndex: 100,
                            background: '#fff',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            maxHeight: '400px',
                            overflowY: 'auto',
                            borderBottomLeftRadius: '8px',
                            borderBottomRightRadius: '8px'
                        }}>
                            {searchResults.length > 0 ? (
                                <List
                                    itemLayout="horizontal"
                                    dataSource={searchResults}
                                    renderItem={(user: any) => (
                                        <List.Item
                                            style={{ cursor: 'pointer', padding: '12px 16px' }}
                                            className="search-result-item"
                                            onMouseDown={(e) => {
                                                e.preventDefault(); // Prevent input blur
                                                handleStartChat(user);
                                            }}
                                        >
                                            <List.Item.Meta
                                                avatar={<Avatar icon={<UserOutlined />} src={user.avatar} />}
                                                title={user.name || user.username}
                                                description={
                                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                                        {user.department?.name || 'Hệ thống'} - {user.position || user.role}
                                                    </Text>
                                                }
                                            />
                                        </List.Item>
                                    )}
                                />
                            ) : (
                                <div style={{ padding: '20px', textAlign: 'center' }}>
                                    {isSearching ? (
                                        <Text type="secondary">Đang tìm kiếm...</Text>
                                    ) : (
                                        <Text type="secondary">Không tìm thấy người dùng nào</Text>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {conversations.map(conv => (
                        <div
                            key={conv.id}
                            className={`conversation-item ${selectedConv?.id === conv.id ? 'active' : ''}`}
                            onClick={() => setSelectedConv(conv)}
                        >
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                <div style={{ position: 'relative' }}>
                                    <Avatar size={40} src={conv.otherUser?.avatar}>
                                        {conv.otherUser?.name?.[0] || conv.otherUser?.username?.[0]}
                                    </Avatar>
                                    {conv.otherUser?.status === 'online' && (
                                        <div style={{
                                            position: 'absolute',
                                            bottom: 0,
                                            right: 0,
                                            width: 10,
                                            height: 10,
                                            background: '#52c41a',
                                            borderRadius: '50%',
                                            border: '2px solid #fff'
                                        }} />
                                    )}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text strong ellipsis>{conv.otherUser?.name || conv.otherUser?.username}</Text>
                                        <Text type="secondary" style={{ fontSize: 11 }}>
                                            {conv.lastMessage ? dayjs(conv.lastMessage.createdAt).format('HH:mm') : ''}
                                        </Text>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                        <Text type="secondary" ellipsis style={{ fontSize: 13, flex: 1 }}>
                                            {conv.lastMessage ? (conv.lastMessage.senderId === currentUser?.id ? 'Bạn: ' : '') + (conv.lastMessage.text || '[Tệp đính kèm]') : 'Chưa có tin nhắn'}
                                        </Text>
                                        {/* Show unread dot if it's not the selected conversation and last message is from other user */}
                                        {selectedConv?.id !== conv.id && conv.lastMessage && conv.lastMessage.senderId !== currentUser?.id && (
                                            <div style={{
                                                width: 8, height: 8, background: '#ff4d4f', borderRadius: '50%', flexShrink: 0
                                            }} />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="chat-main">
                {!selectedConv ? (
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f4f7f6' }}>
                        <Text type="secondary">Vui lòng chọn một cuộc hội thoại để bắt đầu</Text>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="chat-header">
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                <Avatar size={40}>{selectedConv.otherUser?.name?.[0] || selectedConv.otherUser?.username?.[0]}</Avatar>
                                <div>
                                    <Text strong block style={{ lineHeight: '1.2' }}>{selectedConv.otherUser?.name || selectedConv.otherUser?.username}</Text>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                        {selectedConv.otherUser?.status === 'online' ? (
                                            <>
                                                <span className="status-pulse" />
                                                <Text type="success" style={{ fontSize: 11, fontWeight: 500, marginLeft: 2 }}>Đang hoạt động</Text>
                                            </>
                                        ) : (
                                            <>
                                                <Badge status="default" />
                                                <Text type="secondary" style={{ fontSize: 11 }}>Truy cập vài phút trước</Text>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <Button type="text" icon={<MoreOutlined style={{ fontSize: 20 }} />} />
                        </div>

                        {/* History */}
                        <div className="chat-history" ref={historyRef}>
                            <div style={{ textAlign: 'center', margin: '12px 0' }}>
                                <Text type="secondary" style={{ fontSize: 12, background: '#eef0f2', padding: '2px 10px', borderRadius: '10px' }}>
                                    Lịch sử trò chuyện
                                </Text>
                            </div>

                            {messages.map((msg: any) => {
                                const isSent = msg.senderId === currentUser?.id;
                                return (
                                    <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isSent ? 'flex-end' : 'flex-start', marginBottom: 16 }}>
                                        {/* Attachments */}
                                        {renderAttachments(msg)}

                                        {/* Text Bubble */}
                                        {msg.text && (
                                            <div className={`message-bubble ${isSent ? 'message-sent' : 'message-received'}`} style={{ marginTop: msg.attachments?.length > 0 ? 4 : 0 }}>
                                                <div className="message-content">{msg.text}</div>
                                                <span className="message-time">{dayjs(msg.createdAt).format('HH:mm')}</span>
                                            </div>
                                        )}

                                        {/* Time for messages without text */}
                                        {!msg.text && msg.attachments?.length > 0 && (
                                            <span className="message-time" style={{ color: '#8c8c8c', marginTop: 4 }}>
                                                {dayjs(msg.createdAt).format('HH:mm')}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Input Area */}
                        <div className="chat-input-area">
                            {/* Pending Files Preview */}
                            {pendingFiles.length > 0 && (
                                <div style={{ marginBottom: 12, padding: '8px', background: '#f5f5f5', borderRadius: '8px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {pendingFiles.map(file => (
                                        <Badge
                                            key={file.uid}
                                            count={<span style={{ cursor: 'pointer', background: '#ff4d4f', color: '#fff', borderRadius: '50%', padding: '0 4px', fontSize: 10 }}>×</span>}
                                            onClick={() => setPendingFiles(prev => prev.filter(f => f.uid !== file.uid))}
                                        >
                                            <div style={{ padding: '4px 10px', background: '#fff', border: '1px solid #d9d9d9', borderRadius: '4px', fontSize: 12 }}>
                                                <PaperClipOutlined style={{ marginRight: 4 }} />
                                                {file.name}
                                            </div>
                                        </Badge>
                                    ))}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                                <Space style={{ paddingBottom: 4 }}>
                                    <Upload
                                        multiple
                                        beforeUpload={(file) => {
                                            // Store the raw File object with a wrapper that includes originFileObj
                                            const fileWrapper = {
                                                uid: `${Date.now()}-${file.name}`,
                                                name: file.name,
                                                originFileObj: file
                                            };
                                            setPendingFiles(prev => [...prev, fileWrapper as any]);
                                            return false; // Prevent auto upload
                                        }}
                                        showUploadList={false}
                                    >
                                        <Button type="text" icon={<PaperClipOutlined style={{ fontSize: 20 }} />} />
                                    </Upload>
                                </Space>
                                <Input.TextArea
                                    placeholder={`Nhập @, tin nhắn tới ${selectedConv.otherUser?.name || selectedConv.otherUser?.username || 'Người dùng'}`}
                                    autoSize={{ minRows: 1, maxRows: 4 }}
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onPressEnter={(e) => {
                                        if (!e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessage();
                                        }
                                    }}
                                    style={{ borderRadius: '8px' }}
                                />
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ChatPage;
