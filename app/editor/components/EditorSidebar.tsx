import { useState, useRef } from 'react';
import {
    Video,
    Image as ImageIcon,
    Music,
    Type,
    Sparkles,
    Search,
    Plus,
    X,
    Upload
} from 'lucide-react';

interface EditorSidebarProps {
    assets: {
        videos: any[];
        images: any[];
        audio: any[];
    };
    onAddAsset: (asset: any, type: 'video' | 'image' | 'audio') => void;
    onUploadComplete?: () => void;
    loading: boolean;
}

type Tab = 'media' | 'audio' | 'text' | 'effects';

export default function EditorSidebar({ assets, onAddAsset, onUploadComplete, loading }: EditorSidebarProps) {
    const [activeTab, setActiveTab] = useState<Tab>('media');
    const [mediaType, setMediaType] = useState<'video' | 'image'>('video');
    const [searchQuery, setSearchQuery] = useState('');
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', mediaType);

            const response = await fetch('/api/assets/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Upload failed');
            }

            const data = await response.json();

            // Refresh assets list
            if (onUploadComplete) {
                onUploadComplete();
            }

            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }

            alert(`${mediaType === 'video' ? 'Video' : 'Image'} uploaded successfully!`);
        } catch (error: any) {
            console.error('Upload error:', error);
            alert(error.message || 'Failed to upload file');
        } finally {
            setUploading(false);
        }
    };

    const tabs = [
        { id: 'media', icon: Video, label: 'Media' },
        { id: 'audio', icon: Music, label: 'Audio' },
        { id: 'text', icon: Type, label: 'Text' },
        { id: 'effects', icon: Sparkles, label: 'Effects' },
    ];

    const filteredAssets = () => {
        if (activeTab === 'media') {
            const list = mediaType === 'video' ? assets.videos : assets.images;
            return list.filter(a => (a.prompt || '').toLowerCase().includes(searchQuery.toLowerCase()));
        }
        if (activeTab === 'audio') {
            return assets.audio.filter(a => (a.prompt || '').toLowerCase().includes(searchQuery.toLowerCase()));
        }
        return [];
    };

    return (
        <div className="flex h-full bg-[#18181b] border-r border-gray-800">
            {/* Icon Rail */}
            <div className="w-16 flex flex-col items-center py-4 gap-4 border-r border-gray-800 bg-[#09090b]">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as Tab)}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all w-14 ${activeTab === tab.id
                                ? 'text-white bg-gray-800'
                                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'
                            }`}
                    >
                        <tab.icon size={20} />
                        <span className="text-[10px] font-medium">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Content Drawer */}
            <div className="w-72 flex flex-col bg-[#18181b]">
                <div className="p-4 border-b border-gray-800">
                    <h2 className="text-white font-bold text-lg mb-4 capitalize">{activeTab}</h2>

                    {activeTab === 'media' && (
                        <>
                            <div className="flex bg-gray-900 p-1 rounded-lg mb-3">
                                <button
                                    onClick={() => setMediaType('video')}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${mediaType === 'video' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
                                        }`}
                                >
                                    Videos
                                </button>
                                <button
                                    onClick={() => setMediaType('image')}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${mediaType === 'image' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
                                        }`}
                                >
                                    Images
                                </button>
                            </div>

                            {/* Upload Button */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept={mediaType === 'video' ? 'video/*' : 'image/*'}
                                onChange={handleFileSelect}
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="w-full mb-3 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                            >
                                <Upload size={14} />
                                {uploading ? 'Uploading...' : `Upload ${mediaType === 'video' ? 'Video' : 'Image'}`}
                            </button>
                        </>
                    )}

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                        <input
                            type="text"
                            placeholder="Search assets..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-900 text-white text-sm py-2 pl-9 pr-4 rounded-lg border border-gray-800 focus:border-gray-600 focus:outline-none"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                            <div className="animate-spin mb-2">🍌</div>
                            <span className="text-xs">Loading...</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            {activeTab === 'media' && filteredAssets().map((asset) => (
                                <div
                                    key={asset.id}
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.effectAllowed = 'copy';
                                        e.dataTransfer.setData('application/json', JSON.stringify({
                                            asset,
                                            type: mediaType
                                        }));
                                    }}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onAddAsset(asset, mediaType);
                                    }}
                                    className="group relative aspect-square bg-gray-900 rounded-lg overflow-hidden border border-gray-800 hover:border-gray-600 transition-all cursor-grab active:cursor-grabbing"
                                >
                                    {mediaType === 'video' ? (
                                        <video
                                            src={asset.url}
                                            className="w-full h-full object-contain pointer-events-none"
                                            muted
                                            playsInline
                                            loop
                                            onMouseEnter={(e) => {
                                                e.currentTarget.currentTime = 0;
                                                e.currentTarget.play().catch(() => {});
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.pause();
                                                e.currentTarget.currentTime = 0;
                                            }}
                                        />
                                    ) : (
                                        <img
                                            src={asset.thumbnail_url || asset.url}
                                            alt=""
                                            className="w-full h-full object-contain pointer-events-none"
                                        />
                                    )}
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                        <Plus className="text-white" size={24} />
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
                                        <p className="text-[10px] text-white truncate px-1">{asset.prompt || 'Untitled'}</p>
                                    </div>
                                </div>
                            ))}

                            {activeTab === 'audio' && filteredAssets().map((asset) => (
                                <div
                                    key={asset.id}
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.effectAllowed = 'copy';
                                        e.dataTransfer.setData('application/json', JSON.stringify({
                                            asset,
                                            type: 'audio'
                                        }));
                                    }}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onAddAsset(asset, 'audio');
                                    }}
                                    className="col-span-2 flex items-center gap-3 p-3 bg-gray-900 rounded-lg border border-gray-800 hover:border-gray-600 transition-all group text-left cursor-grab active:cursor-grabbing"
                                >
                                    <div className="w-8 h-8 bg-gray-800 rounded flex items-center justify-center text-gray-400 group-hover:text-white group-hover:bg-purple-600 transition-colors pointer-events-none">
                                        <Music size={16} />
                                    </div>
                                    <div className="flex-1 min-w-0 pointer-events-none">
                                        <p className="text-xs font-bold text-gray-300 group-hover:text-white truncate">
                                            {asset.prompt || 'Audio Track'}
                                        </p>
                                        <p className="text-[10px] text-gray-500">00:10</p>
                                    </div>
                                    <Plus size={16} className="text-gray-500 group-hover:text-white opacity-0 group-hover:opacity-100 transition-all pointer-events-none" />
                                </div>
                            ))}

                            {filteredAssets().length === 0 && !loading && (
                                <div className="col-span-2 text-center py-8 text-gray-500">
                                    <p className="text-sm">No assets found</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
