import React, { useState, useEffect, useRef } from 'react';
import { Input, List, Avatar, Typography, Badge, Space, Button, Divider, Tooltip, Upload, UploadFile, message as antdMessage, Image, Modal, Select, Tag } from 'antd';
import { SearchOutlined, PaperClipOutlined, MoreOutlined, UserOutlined, LoadingOutlined, FileTextOutlined, DownloadOutlined, UsergroupAddOutlined, TeamOutlined, UserAddOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
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
    const [createGroupModalVisible, setCreateGroupModalVisible] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
    const [addMemberModalVisible, setAddMemberModalVisible] = useState(false);
    const [newMemberIds, setNewMemberIds] = useState<number[]>([]);
    const [groupInfoVisible, setGroupInfoVisible] = useState(false);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
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

        // Listen for conversation updates (e.g. member added/removed)
        const handleConversationUpdate = (data: any) => {
            if (data.conversationId) {
                // If currently viewing this conversation, reload it to get fresh participants
                if (selectedConv && selectedConv.id === parseInt(data.conversationId)) {
                    // We can just trigger loadConversations -> it will fetch fresh list
                    // But we might also want to update selectedConv explicitly if list update doesn't trigger it
                    loadConversations().then(async () => {
                        // Re-fetch selected conversation details if needed or rely on list
                        // getConversations returns full structure including participants
                        const updatedList = await chatService.getConversations();
                        const updated = updatedList.find((c: any) => c.id === parseInt(data.conversationId));
                        if (updated) setSelectedConv(updated);
                    });
                } else {
                    loadConversations();
                }
            }
        };
        socketService.on('conversation_updated', handleConversationUpdate);

        // Also join room for selected conversation if not already joinable via global
        if (selectedConv) {
            socketService.joinConversation(selectedConv.id);
        }

        return () => {
            socketService.offReceiveMessage(handleChatPageMessage);
            socketService.off('conversation_updated', handleConversationUpdate);
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
            // If focused but empty, show initial list
            if (isSearchFocused) {
                handleSearchFocus();
            } else {
                setSearchResults([]);
                setIsSearching(false);
            }
            return;
        }

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

    const handleSearchFocus = async () => {
        setIsSearchFocused(true);
        if (!searchText.trim()) {
            setIsSearching(true);
            try {
                // Remove limit or make it large, and use scope='all' to see everyone regardless of department
                const data = await userService.getUsers({ limit: 1000, scope: 'all' });
                setSearchResults(data.results.filter((u: any) => u.id !== currentUser?.id));
            } catch (error) {
                console.error('Initial search failed', error);
            } finally {
                setIsSearching(false);
            }
        }
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchText(e.target.value);
        setIsSearching(true);
    };

    const fetchUsersForGroup = async () => {
        try {
            const data = await userService.getUsers({ limit: 1000, scope: 'all' });
            setAllUsers(data.results.filter((u: any) => u.id !== currentUser?.id));
        } catch (error) {
            antdMessage.error('Không thể tải danh sách người dùng');
        }
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim()) {
            antdMessage.warning('Vui lòng nhập tên nhóm');
            return;
        }
        if (selectedMemberIds.length === 0) {
            antdMessage.warning('Vui lòng chọn ít nhất một thành viên');
            return;
        }

        try {
            const newGroup = await chatService.createGroup(groupName, selectedMemberIds);
            antdMessage.success('Đã tạo nhóm thành công');
            setCreateGroupModalVisible(false);
            setGroupName('');
            setSelectedMemberIds([]);

            // Join the new group socket room
            socketService.joinConversation(newGroup.id);

            await loadConversations();
            setSelectedConv(newGroup);
        } catch (error) {
            antdMessage.error('Không thể tạo nhóm');
        }
    };

    const handleAddNewMembers = async () => {
        if (!selectedConv) return;
        if (newMemberIds.length === 0) {
            antdMessage.warning('Vui lòng chọn ít nhất một thành viên');
            return;
        }

        try {
            await chatService.addParticipants(selectedConv.id, newMemberIds);
            antdMessage.success('Đã thêm thành viên');
            setAddMemberModalVisible(false);
            setNewMemberIds([]);

            await loadConversations();
            // Refresh conversation explicitly from server to get updated participants
            const updatedList = await chatService.getConversations();
            const updated = updatedList.find((c: any) => c.id === selectedConv.id);
            if (updated) setSelectedConv(updated);
        } catch (error) {
            antdMessage.error('Không thể thêm thành viên');
        }
    };

    const handleRemoveMember = async (userId: number) => {
        if (!selectedConv) return;
        try {
            await chatService.removeParticipant(selectedConv.id, userId);
            antdMessage.success('Đã xóa thành viên');
            await loadConversations();
            const updated = (await chatService.getConversations()).find((c: any) => c.id === selectedConv.id);
            if (updated) setSelectedConv(updated);
        } catch (error) {
            antdMessage.error('Không thể xóa thành viên');
        }
    };

    const handleDeleteGroup = async () => {
        if (!selectedConv) return;
        Modal.confirm({
            title: 'Giải tán nhóm',
            icon: <ExclamationCircleOutlined />,
            content: 'Bạn có chắc chắn muốn giải tán nhóm này? Toàn bộ tin nhắn sẽ bị xóa.',
            okText: 'Giải tán',
            okType: 'danger',
            cancelText: 'Hủy',
            onOk: async () => {
                try {
                    await chatService.deleteConversation(selectedConv.id);
                    antdMessage.success('Đã giải tán nhóm');
                    setGroupInfoVisible(false);
                    setSelectedConv(null);
                    await loadConversations();
                } catch (error) {
                    antdMessage.error('Không thể giải tán nhóm');
                }
            },
        });
    };

    const handleStartChat = async (otherUser: any) => {
        setSearchText('');
        setSearchResults([]);
        setIsSearching(false);
        try {
            const conversation = await chatService.getOrCreateConversation(otherUser.id);
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <Title level={4} style={{ margin: 0 }}>Tin nhắn</Title>
                        <Tooltip title="Tạo nhóm mới">
                            <Button
                                type="primary"
                                shape="circle"
                                icon={<UsergroupAddOutlined />}
                                onClick={() => {
                                    setCreateGroupModalVisible(true);
                                    fetchUsersForGroup();
                                }}
                            />
                        </Tooltip>
                    </div>
                    <Input
                        prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                        suffix={isSearching ? <LoadingOutlined style={{ color: '#1890ff' }} /> : null}
                        placeholder="Tìm kiếm người dùng..."
                        style={{ borderRadius: '6px' }}
                        value={searchText}
                        onChange={handleSearchChange}
                        onFocus={handleSearchFocus}
                        onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                    />

                    {/* Search Results Overlay */}
                    {isSearchFocused && (searchResults.length > 0 || isSearching) && (
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
                                                title={<span>{user.name || user.username} - <Text type="secondary" style={{ fontSize: 13, fontWeight: 'normal' }}>{user.department?.name || 'Hệ thống'}</Text></span>}
                                                description={
                                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                                        {user.position || user.role}
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
                    {conversations.map(conv => {
                        const isGroup = conv.type === 'GROUP';
                        const displayName = isGroup ? conv.name : (conv.otherUser?.name || conv.otherUser?.username);
                        const displayAvatar = isGroup ? <TeamOutlined /> : (conv.otherUser?.name?.[0] || conv.otherUser?.username?.[0]);

                        return (
                            <div
                                key={conv.id}
                                className={`conversation-item ${selectedConv?.id === conv.id ? 'active' : ''}`}
                                onClick={() => setSelectedConv(conv)}
                            >
                                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                    <div style={{ position: 'relative' }}>
                                        <Avatar size={40} src={isGroup ? null : conv.otherUser?.avatar} icon={isGroup ? <TeamOutlined /> : null}>
                                            {displayAvatar}
                                        </Avatar>
                                        {!isGroup && conv.otherUser?.status === 'online' && (
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
                                            <Text strong ellipsis>{displayName}</Text>
                                            <Text type="secondary" style={{ fontSize: 11 }}>
                                                {conv.lastMessage ? dayjs(conv.lastMessage.createdAt).format('HH:mm') : ''}
                                            </Text>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                            <Text type="secondary" ellipsis style={{ fontSize: 13, flex: 1 }}>
                                                {conv.lastMessage ? (conv.lastMessage.senderId === currentUser?.id ? 'Bạn: ' : '') + (conv.lastMessage.text || '[Tệp đính kèm]') : 'Chưa có tin nhắn'}
                                            </Text>
                                            {selectedConv?.id !== conv.id && conv.lastMessage && conv.lastMessage.senderId !== currentUser?.id && (
                                                <div style={{
                                                    width: 8, height: 8, background: '#ff4d4f', borderRadius: '50%', flexShrink: 0
                                                }} />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="chat-main">
                {!selectedConv ? (
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f4f7f6' }}>
                        <Text type="secondary">Vui lòng chọn một cuộc hội thoại để bắt đầu</Text>
                    </div>
                ) : (
                    <div className="chat-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        {/* Header */}
                        <div className="chat-header" style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                <Avatar size={40} icon={selectedConv.type === 'GROUP' ? <TeamOutlined /> : null}>
                                    {selectedConv.type === 'GROUP' ? null : (selectedConv.otherUser?.name?.[0] || selectedConv.otherUser?.username?.[0])}
                                </Avatar>
                                <div>
                                    <Text strong block style={{ lineHeight: '1.2' }}>
                                        {selectedConv.type === 'GROUP' ? selectedConv.name : (selectedConv.otherUser?.name || selectedConv.otherUser?.username)}
                                    </Text>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                        {selectedConv.type === 'GROUP' ? (
                                            <Text type="secondary" style={{ fontSize: 11 }}>{selectedConv.participants?.length || 0} thành viên</Text>
                                        ) : selectedConv.otherUser?.status === 'online' ? (
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
                            <Button type="text" icon={<MoreOutlined style={{ fontSize: 20 }} />} onClick={() => setGroupInfoVisible(true)} />
                        </div>

                        {/* History */}
                        <div className="chat-history" ref={historyRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', background: '#f4f7f6' }}>
                            <div style={{ textAlign: 'center', margin: '12px 0' }}>
                                <Text type="secondary" style={{ fontSize: 12, background: '#eef0f2', padding: '2px 10px', borderRadius: '10px' }}>
                                    Lịch sử trò chuyện
                                </Text>
                            </div>

                            {messages.map((msg: any) => {
                                const isSent = msg.senderId === currentUser?.id;
                                return (
                                    <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isSent ? 'flex-end' : 'flex-start', marginBottom: 16 }}>
                                        {/* Sender Name for Group Chats (Incoming only) */}
                                        {!isSent && selectedConv.type === 'GROUP' && (
                                            <Text type="secondary" style={{ fontSize: 11, marginBottom: 2, marginLeft: 4 }}>
                                                {msg.sender?.name || msg.sender?.username || 'Người dùng'}
                                            </Text>
                                        )}

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
                        <div className="chat-input-area" style={{ padding: '16px', borderTop: '1px solid #f0f0f0', background: '#fff' }}>
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
                                            const fileWrapper = {
                                                uid: `${Date.now()}-${file.name}`,
                                                name: file.name,
                                                originFileObj: file
                                            };
                                            setPendingFiles(prev => [...prev, fileWrapper as any]);
                                            return false;
                                        }}
                                        showUploadList={false}
                                    >
                                        <Button type="text" icon={<PaperClipOutlined style={{ fontSize: 20 }} />} />
                                    </Upload>
                                </Space>
                                <Input.TextArea
                                    placeholder={`Nhập @, tin nhắn tới ${selectedConv.name || selectedConv.otherUser?.name || selectedConv.otherUser?.username || 'Người dùng'}`}
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
                    </div>
                )}
            </div>

            {/* Create Group Modal */}
            <Modal
                title="Tạo nhóm mới"
                open={createGroupModalVisible}
                onOk={handleCreateGroup}
                onCancel={() => setCreateGroupModalVisible(false)}
                okText="Tạo nhóm"
                cancelText="Hủy"
            >
                <div style={{ marginBottom: 16 }}>
                    <Text strong>Tên nhóm</Text>
                    <Input
                        placeholder="Nhập tên nhóm..."
                        value={groupName}
                        onChange={e => setGroupName(e.target.value)}
                        style={{ marginTop: 8 }}
                    />
                </div>
                <div>
                    <Text strong>Thành viên</Text>
                    <Select
                        mode="multiple"
                        style={{ width: '100%', marginTop: 8 }}
                        placeholder="Chọn thành viên..."
                        value={selectedMemberIds}
                        onChange={setSelectedMemberIds}
                        optionFilterProp="children"
                    >
                        {allUsers.map(u => (
                            <Select.Option key={u.id} value={u.id}>
                                {u.name || u.username} - {u.department?.name || 'Hệ thống'}
                            </Select.Option>
                        ))}
                    </Select>
                </div>
            </Modal>

            {/* Group Info / Members Modal */}
            <Modal
                title={selectedConv?.type === 'GROUP' ? `Thông tin nhóm: ${selectedConv.name}` : 'Thông tin người dùng'}
                open={groupInfoVisible}
                onCancel={() => setGroupInfoVisible(false)}
                footer={null}
            >
                {selectedConv?.type === 'GROUP' ? (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text strong>Thành viên ({selectedConv.participants?.length})</Text>
                            {(selectedConv.leaderId === currentUser?.id || currentUser?.role === 'ADMIN') && (
                                <Space>
                                    <Button type="primary" icon={<UserAddOutlined />} onClick={() => {
                                        fetchUsersForGroup();
                                        setAddMemberModalVisible(true);
                                    }}>Thêm thành viên</Button>
                                    <Button type="link" danger icon={<DeleteOutlined />} onClick={handleDeleteGroup}>Giải tán nhóm</Button>
                                </Space>
                            )}
                        </div>
                        <List
                            itemLayout="horizontal"
                            dataSource={selectedConv.participants}
                            renderItem={(p: any) => (
                                <List.Item
                                    actions={[
                                        (selectedConv.leaderId === currentUser?.id || currentUser?.role === 'ADMIN') && p.userId !== currentUser?.id ? (
                                            <Button type="link" danger onClick={() => handleRemoveMember(p.userId)}>Xóa</Button>
                                        ) : null
                                    ]}
                                >
                                    <List.Item.Meta
                                        avatar={<Avatar>{p.user?.name?.[0] || p.user?.username?.[0]}</Avatar>}
                                        title={<span>{p.user?.name || p.user?.username} {p.userId === selectedConv.leaderId && <Tag color="gold" style={{ marginLeft: 8 }}>Trưởng nhóm</Tag>}</span>}
                                        description={p.user?.department?.name}
                                    />
                                </List.Item>
                            )}
                        />
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <Avatar size={80} style={{ marginBottom: 16 }}>{selectedConv?.otherUser?.name?.[0] || selectedConv?.otherUser?.username?.[0]}</Avatar>
                        <Title level={4}>{selectedConv?.otherUser?.name || selectedConv?.otherUser?.username}</Title>
                        <Text type="secondary" block>{selectedConv?.otherUser?.department?.name || 'Hệ thống'}</Text>
                        <Text type="secondary">{selectedConv?.otherUser?.position || selectedConv?.otherUser?.role}</Text>
                    </div>
                )}
            </Modal>

            {/* Add Member Modal */}
            <Modal
                title="Thêm thành viên vào nhóm"
                open={addMemberModalVisible}
                onOk={handleAddNewMembers}
                onCancel={() => setAddMemberModalVisible(false)}
                okText="Thêm"
                cancelText="Hủy"
            >
                <div>
                    <Text strong>Chọn thành viên</Text>
                    <Select
                        mode="multiple"
                        style={{ width: '100%', marginTop: 8 }}
                        placeholder="Chọn thành viên..."
                        value={newMemberIds}
                        onChange={setNewMemberIds}
                        optionFilterProp="children"
                    >
                        {allUsers
                            .filter(u => !selectedConv?.participants?.some((p: any) => p.userId === u.id)) // Exclude existing members
                            .map(u => (
                                <Select.Option key={u.id} value={u.id}>
                                    {u.name || u.username} - {u.department?.name || 'Hệ thống'}
                                </Select.Option>
                            ))}
                    </Select>
                </div>
            </Modal>
        </div >
    );
};

export default ChatPage;
