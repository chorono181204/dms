import React, { useEffect, useState } from 'react';
import { Drawer, Timeline, Card, Tag, Button, Typography, Space, Tooltip, message, Popconfirm } from 'antd';
import { ClockCircleOutlined, DownloadOutlined, RollbackOutlined, FilePdfOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import * as versionService from '../api/services/version.service';
import { Version } from '../api/services/version.service';

const { Text, Title } = Typography;

interface VersionHistoryPanelProps {
    documentId: number;
    visible: boolean;
    onClose: () => void;
    canEdit?: boolean;
    onRestore?: () => void;
}

const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({
    documentId,
    visible,
    onClose,
    canEdit = false,
    onRestore
}) => {
    const [versions, setVersions] = useState<Version[]>([]);
    const [loading, setLoading] = useState(false);
    const [restoring, setRestoring] = useState<number | null>(null);

    const fetchVersions = async () => {
        if (!documentId) return;
        setLoading(true);
        try {
            const data = await versionService.getVersions(documentId);
            setVersions(data);
        } catch (error) {
            message.error('Không thể tải lịch sử phiên bản');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (visible) {
            fetchVersions();
        }
    }, [visible, documentId]);

    const handleDownload = async (version: Version) => {
        try {
            const blob = await versionService.downloadVersion(documentId, version.versionNumber);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `document_v${version.versionNumber}.pdf`; // Simple name, extension should be dynamic ideally but we force PDF/DOCX usually
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            message.error('Lỗi khi tải xuống phiên bản');
        }
    };

    const handleRestore = async (version: Version) => {
        setRestoring(version.versionNumber);
        try {
            await versionService.restoreVersion(documentId, version.versionNumber);
            message.success(`Đã khôi phục phiên bản ${version.versionNumber}`);
            fetchVersions(); // Refresh list to show new version (created from restore)
            if (onRestore) onRestore();
        } catch (error) {
            message.error('Lỗi khi khôi phục phiên bản');
        } finally {
            setRestoring(null);
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const fixGarbledText = (text: string) => {
        if (!text) return text;
        // Common garbled patterns
        return text
            .replace(/Khá»Ÿi táº¡o tĂ i liá»‡u/g, 'Khởi tạo tài liệu')
            .replace(/Lá»—i chuyá»ƒn Ä‘á»•i file sang PDF/g, 'Lỗi chuyển đổi file sang PDF')
            .replace(/KhĂ´i phá»¥c tá»« phiĂªn báº£n/g, 'Khôi phục từ phiên bản')
            .replace(/Cáº­p nháº­t tĂ i liá»‡u/g, 'Cập nhật tài liệu');
    };

    return (
        <Drawer
            title="Lịch sử phiên bản"
            placement="right"
            onClose={onClose}
            open={visible}
            width={400}
        >
            <Timeline
                mode="left"
                items={versions.map((version, index) => {
                    const isLatest = index === 0;
                    return {
                        color: isLatest ? 'green' : 'blue',
                        label: (
                            <Space direction="vertical" size={0}>
                                <Text strong>{dayjs(version.createdAt).format('DD/MM/YYYY')}</Text>
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                    {dayjs(version.createdAt).format('HH:mm')}
                                </Text>
                            </Space>
                        ),
                        children: (
                            <div
                                style={{
                                    padding: '8px 12px',
                                    border: '1px solid',
                                    borderColor: isLatest ? '#b7eb8f' : '#f0f0f0',
                                    backgroundColor: isLatest ? '#f6ffed' : '#fff',
                                    borderRadius: 6,
                                    marginBottom: 8,
                                    width: '100%'
                                }}
                            >
                                <Space direction="vertical" style={{ width: '100%' }} size={0}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                        <Tag color={isLatest ? 'success' : 'default'} style={{ margin: 0, fontSize: '10px', lineHeight: '18px' }}>
                                            v{version.versionNumber}
                                        </Tag>
                                        <Text type="secondary" style={{ fontSize: '10px' }}>
                                            {formatFileSize(version.fileSize)}
                                        </Text>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                        <FilePdfOutlined style={{ fontSize: '12px' }} />
                                        <Text style={{ fontSize: '12px', fontWeight: 500 }} ellipsis>
                                            {fixGarbledText(version.changeNote) || 'Cập nhật tài liệu'}
                                        </Text>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text type="secondary" style={{ fontSize: '10px' }}>
                                            <span style={{ marginRight: 4 }}>Bởi:</span>
                                            {version.createdByName || version.createdBy}
                                        </Text>

                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <Tooltip title="Tải xuống">
                                                <Button
                                                    type="text"
                                                    icon={<DownloadOutlined style={{ fontSize: '12px' }} />}
                                                    size="small"
                                                    style={{ width: 24, height: 24, minWidth: 24 }}
                                                    onClick={() => handleDownload(version)}
                                                />
                                            </Tooltip>

                                            {!isLatest && version.versionNumber !== 1 && canEdit && (
                                                <Popconfirm
                                                    title="Khôi phục?"
                                                    description="Tạo phiên bản mới từ bản này."
                                                    onConfirm={() => handleRestore(version)}
                                                    okText="OK"
                                                    cancelText="Hủy"
                                                >
                                                    <Tooltip title="Khôi phục">
                                                        <Button
                                                            type="text"
                                                            danger
                                                            icon={<RollbackOutlined style={{ fontSize: '12px' }} />}
                                                            size="small"
                                                            style={{ width: 24, height: 24, minWidth: 24 }}
                                                            loading={restoring === version.versionNumber}
                                                        />
                                                    </Tooltip>
                                                </Popconfirm>
                                            )}
                                        </div>
                                    </div>
                                </Space>
                            </div>
                        )
                    };
                })}
            />
        </Drawer>
    );
};

export default VersionHistoryPanel;
