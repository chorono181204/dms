import { useState, useRef, useEffect } from 'react';
import { Modal, Button } from 'antd';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface ImageCropModalProps {
    visible: boolean;
    imageFile: File | null;
    onCancel: () => void;
    onConfirm: (croppedBlob: Blob) => void;
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
    visible,
    imageFile,
    onCancel,
    onConfirm,
}) => {
    const [crop, setCrop] = useState<Crop>({
        unit: '%',
        width: 80,
        height: 50,
        x: 10,
        y: 25,
    });
    const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
    const [imageSrc, setImageSrc] = useState<string>('');
    const imgRef = useRef<HTMLImageElement>(null);

    // Load image when file changes
    useEffect(() => {
        if (imageFile) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setImageSrc(e.target?.result as string);
            };
            reader.readAsDataURL(imageFile);
        }
    }, [imageFile]);

    const handleConfirm = async () => {
        if (!completedCrop || !imgRef.current) {
            return;
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
        const scaleY = imgRef.current.naturalHeight / imgRef.current.height;

        canvas.width = completedCrop.width * scaleX;
        canvas.height = completedCrop.height * scaleY;

        ctx.drawImage(
            imgRef.current,
            completedCrop.x * scaleX,
            completedCrop.y * scaleY,
            completedCrop.width * scaleX,
            completedCrop.height * scaleY,
            0,
            0,
            canvas.width,
            canvas.height
        );

        canvas.toBlob((blob) => {
            if (blob) {
                onConfirm(blob);
            }
        }, 'image/png');
    };

    return (
        <Modal
            title="Cắt ảnh chữ ký"
            open={visible}
            onCancel={onCancel}
            footer={[
                <Button key="cancel" onClick={onCancel}>
                    Hủy
                </Button>,
                <Button key="confirm" type="primary" onClick={handleConfirm}>
                    Xác nhận
                </Button>,
            ]}
            width={800}
        >
            {imageSrc && (
                <div style={{ maxHeight: '500px', overflow: 'auto' }}>
                    <ReactCrop
                        crop={crop}
                        onChange={(c) => setCrop(c)}
                        onComplete={(c) => setCompletedCrop(c)}
                    >
                        <img
                            ref={imgRef}
                            src={imageSrc}
                            alt="Crop preview"
                            style={{ maxWidth: '100%' }}
                        />
                    </ReactCrop>
                </div>
            )}
        </Modal>
    );
};
