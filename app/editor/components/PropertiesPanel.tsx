import {
    Volume2,
    Type,
    Trash2,
    Clock,
    Scissors,
    Layers,
    Move,
    Maximize2,
    RotateCw,
    Wand2
} from 'lucide-react';

interface TimelineClip {
    id: string;
    type: 'video' | 'image' | 'audio';
    duration: number;
    volume?: number;
    text?: string;
    trimStart?: number;
    trimEnd?: number;
    transition?: 'none' | 'fade' | 'slide';
    layer?: 'base' | 'overlay';
    smartCut?: boolean;
    overlayX?: number;
    overlayY?: number;
    overlayScale?: number;
    overlayRotation?: number;
    overlayWidth?: number;
    overlayHeight?: number;
}

interface PropertiesPanelProps {
    selectedClip: TimelineClip | null;
    onUpdateClip: (id: string, updates: Partial<TimelineClip>) => void;
    onDeleteClip: (id: string) => void;
    onExport: () => void;
    isExporting: boolean;
    credits: number;
    cost: number;
    onAnalyzeSmartCut?: (clipId: string) => void;
    analyzingSmartCut?: string | null;
    smartCutResult?: {
        clipId: string;
        prevClipId: string;
        video1TrimEnd: number;
        video2TrimStart: number;
        confidence: string;
    } | null;
}

export default function PropertiesPanel({
    selectedClip,
    onUpdateClip,
    onDeleteClip,
    onExport,
    isExporting,
    credits,
    cost,
    onAnalyzeSmartCut,
    analyzingSmartCut,
    smartCutResult
}: PropertiesPanelProps) {
    if (!selectedClip) {
        return (
            <div className="w-72 bg-[#18181b] border-l border-gray-800 p-4 flex flex-col">
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500 text-center">
                    <Layers size={48} className="mb-4 opacity-20" />
                    <p className="text-sm font-medium">Select a clip to edit properties</p>
                </div>

                <div className="border-t border-gray-800 pt-4">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-xs font-bold text-gray-400">ESTIMATED COST</span>
                        <span className="text-sm font-black text-yellow-400">{cost} 🍌</span>
                    </div>
                    <button
                        onClick={onExport}
                        disabled={isExporting}
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isExporting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Exporting...
                            </>
                        ) : (
                            'Export Video'
                        )}
                    </button>
                    <p className="text-[10px] text-gray-500 text-center mt-2">
                        Balance: {credits} Credits
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-72 bg-[#18181b] border-l border-gray-800 flex flex-col">
            <div className="p-4 border-b border-gray-800">
                <h2 className="text-white font-bold text-lg flex items-center gap-2">
                    {selectedClip.type === 'video' ? '🎥 Video' : selectedClip.type === 'image' ? '🖼️ Image' : '🎵 Audio'}
                    <span className="text-xs font-normal text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                        Properties
                    </span>
                </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Duration */}
                <div>
                    <div className="flex items-center gap-2 text-gray-400 mb-2">
                        <Clock size={14} />
                        <label className="text-xs font-bold uppercase">Duration</label>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="range"
                            min="1"
                            max="30"
                            step="0.5"
                            value={selectedClip.duration}
                            onChange={(e) => onUpdateClip(selectedClip.id, { duration: Number(e.target.value) })}
                            className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                        />
                        <span className="text-sm font-mono text-white w-12 text-right">
                            {selectedClip.duration.toFixed(1)}s
                        </span>
                    </div>
                </div>

                {/* Volume (Video/Audio only) */}
                {(selectedClip.type === 'video' || selectedClip.type === 'audio') && (
                    <div>
                        <div className="flex items-center gap-2 text-gray-400 mb-2">
                            <Volume2 size={14} />
                            <label className="text-xs font-bold uppercase">Volume</label>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={selectedClip.volume ?? 100}
                                onChange={(e) => onUpdateClip(selectedClip.id, { volume: Number(e.target.value) })}
                                className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                            />
                            <span className="text-sm font-mono text-white w-12 text-right">
                                {selectedClip.volume ?? 100}%
                            </span>
                        </div>
                    </div>
                )}

                {/* Trim (Video only) */}
                {selectedClip.type === 'video' && (
                    <div>
                        <div className="flex items-center gap-2 text-gray-400 mb-2">
                            <Scissors size={14} />
                            <label className="text-xs font-bold uppercase">Trim</label>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 w-12">Start:</span>
                                <input
                                    type="range"
                                    min="0"
                                    max={selectedClip.duration - 0.5}
                                    step="0.1"
                                    value={selectedClip.trimStart ?? 0}
                                    onChange={(e) => onUpdateClip(selectedClip.id, { trimStart: Number(e.target.value) })}
                                    className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                                />
                                <span className="text-xs font-mono text-white w-12 text-right">
                                    {(selectedClip.trimStart ?? 0).toFixed(1)}s
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 w-12">End:</span>
                                <input
                                    type="range"
                                    min={(selectedClip.trimStart ?? 0) + 0.5}
                                    max={selectedClip.duration}
                                    step="0.1"
                                    value={selectedClip.trimEnd ?? selectedClip.duration}
                                    onChange={(e) => onUpdateClip(selectedClip.id, { trimEnd: Number(e.target.value) })}
                                    className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                                />
                                <span className="text-xs font-mono text-white w-12 text-right">
                                    {(selectedClip.trimEnd ?? selectedClip.duration).toFixed(1)}s
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Text Overlay (Video/Image only) */}
                {selectedClip.type !== 'audio' && (
                    <div>
                        <div className="flex items-center gap-2 text-gray-400 mb-2">
                            <Type size={14} />
                            <label className="text-xs font-bold uppercase">Text Overlay</label>
                        </div>
                        <textarea
                            value={selectedClip.text || ''}
                            onChange={(e) => onUpdateClip(selectedClip.id, { text: e.target.value })}
                            placeholder="Enter text..."
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-purple-500 focus:outline-none resize-none h-24"
                        />
                    </div>
                )}

                {/* Transition (Video/Image only) */}
                {selectedClip.type !== 'audio' && (
                    <div>
                        <div className="flex items-center gap-2 text-gray-400 mb-2">
                            <Layers size={14} />
                            <label className="text-xs font-bold uppercase">Transition</label>
                        </div>
                        <select
                            value={selectedClip.transition || 'none'}
                            onChange={(e) => onUpdateClip(selectedClip.id, { transition: e.target.value as 'none' | 'fade' | 'slide' })}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                        >
                            <option value="none">None</option>
                            <option value="fade">Fade</option>
                            <option value="slide">Slide</option>
                        </select>
                    </div>
                )}

                {/* Smart Cut (Video only) */}
                {selectedClip.type === 'video' && (
                    <div>
                        <div className="flex items-center gap-2 text-gray-400 mb-2">
                            <Wand2 size={14} />
                            <label className="text-xs font-bold uppercase">Smart Cut</label>
                        </div>
                        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3">
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <p className="text-xs text-gray-300">Auto-match frames</p>
                                    <p className="text-[10px] text-gray-500">Find similar frame in previous clip for seamless transition</p>
                                </div>
                                <button
                                    onClick={() => {
                                        if (!selectedClip.smartCut && onAnalyzeSmartCut) {
                                            // Turning ON - trigger analysis
                                            onAnalyzeSmartCut(selectedClip.id);
                                        } else {
                                            // Turning OFF - clear trimStart
                                            onUpdateClip(selectedClip.id, { smartCut: false, trimStart: 0 });
                                        }
                                    }}
                                    disabled={analyzingSmartCut === selectedClip.id}
                                    className={`ml-3 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                                        analyzingSmartCut === selectedClip.id
                                            ? 'bg-yellow-500 text-black animate-pulse'
                                            : selectedClip.smartCut
                                            ? 'bg-green-500 text-white'
                                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                    }`}
                                >
                                    {analyzingSmartCut === selectedClip.id ? (
                                        <span className="flex items-center gap-1">
                                            <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                            Analyzing...
                                        </span>
                                    ) : selectedClip.smartCut ? 'ON' : 'OFF'}
                                </button>
                            </div>

                            {/* Show result */}
                            {smartCutResult && smartCutResult.clipId === selectedClip.id && selectedClip.smartCut && smartCutResult.video1TrimEnd !== undefined && (
                                <div className="mt-3 pt-3 border-t border-gray-700 space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-gray-400">Prev clip end:</span>
                                        <span className="text-blue-400 font-mono">{(smartCutResult.video1TrimEnd ?? 0).toFixed(2)}s</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-gray-400">This clip start:</span>
                                        <span className="text-green-400 font-mono">{(smartCutResult.video2TrimStart ?? 0).toFixed(2)}s</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-gray-400">Confidence:</span>
                                        <span className={`font-bold ${
                                            smartCutResult.confidence === 'EXCELLENT' ? 'text-green-400' :
                                            smartCutResult.confidence === 'VERY_GOOD' ? 'text-green-300' :
                                            smartCutResult.confidence === 'GOOD' ? 'text-yellow-400' :
                                            smartCutResult.confidence === 'ACCEPTABLE' ? 'text-orange-400' :
                                            'text-red-400'
                                        }`}>
                                            {smartCutResult.confidence}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Overlay Controls (Overlay layer images only) */}
                {selectedClip.type === 'image' && selectedClip.layer === 'overlay' && (
                    <div className="space-y-4 pt-4 border-t border-purple-800/30">
                        <div className="bg-purple-900/20 rounded-lg p-3 border border-purple-800/30">
                            <div className="flex items-center gap-2 text-purple-400 mb-3">
                                <Layers size={14} />
                                <label className="text-xs font-bold uppercase">Overlay Position & Size</label>
                            </div>

                            {/* Position X */}
                            <div className="mb-3">
                                <div className="flex items-center gap-2 text-gray-400 mb-1">
                                    <Move size={12} />
                                    <span className="text-xs">Position X</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="range"
                                        min="0"
                                        max="1920"
                                        step="10"
                                        value={selectedClip.overlayX ?? 960}
                                        onChange={(e) => onUpdateClip(selectedClip.id, { overlayX: Number(e.target.value) })}
                                        className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full"
                                    />
                                    <span className="text-xs font-mono text-white w-12 text-right">
                                        {selectedClip.overlayX ?? 960}
                                    </span>
                                </div>
                            </div>

                            {/* Position Y */}
                            <div className="mb-3">
                                <div className="flex items-center gap-2 text-gray-400 mb-1">
                                    <Move size={12} />
                                    <span className="text-xs">Position Y</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="range"
                                        min="0"
                                        max="1080"
                                        step="10"
                                        value={selectedClip.overlayY ?? 540}
                                        onChange={(e) => onUpdateClip(selectedClip.id, { overlayY: Number(e.target.value) })}
                                        className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full"
                                    />
                                    <span className="text-xs font-mono text-white w-12 text-right">
                                        {selectedClip.overlayY ?? 540}
                                    </span>
                                </div>
                            </div>

                            {/* Scale */}
                            <div>
                                <div className="flex items-center gap-2 text-gray-400 mb-1">
                                    <Maximize2 size={12} />
                                    <span className="text-xs">Scale</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="range"
                                        min="0.1"
                                        max="2"
                                        step="0.1"
                                        value={selectedClip.overlayScale ?? 0.5}
                                        onChange={(e) => onUpdateClip(selectedClip.id, { overlayScale: Number(e.target.value) })}
                                        className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full"
                                    />
                                    <span className="text-xs font-mono text-white w-12 text-right">
                                        {((selectedClip.overlayScale ?? 0.5) * 100).toFixed(0)}%
                                    </span>
                                </div>
                            </div>

                            {/* Rotation */}
                            <div>
                                <div className="flex items-center gap-2 text-gray-400 mb-1">
                                    <RotateCw size={12} />
                                    <span className="text-xs">Rotation</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="range"
                                        min="0"
                                        max="360"
                                        step="5"
                                        value={selectedClip.overlayRotation ?? 0}
                                        onChange={(e) => onUpdateClip(selectedClip.id, { overlayRotation: Number(e.target.value) })}
                                        className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full"
                                    />
                                    <span className="text-xs font-mono text-white w-12 text-right">
                                        {selectedClip.overlayRotation ?? 0}°
                                    </span>
                                </div>
                            </div>

                            {/* Quick Presets */}
                            <div className="mt-3 pt-3 border-t border-purple-800/20">
                                <div className="text-[10px] text-gray-500 mb-2">QUICK PRESETS</div>
                                <div className="grid grid-cols-3 gap-1">
                                    <button
                                        onClick={() => onUpdateClip(selectedClip.id, { overlayX: 960, overlayY: 540 })}
                                        className="text-[10px] bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 py-1 rounded transition-colors"
                                    >
                                        Center
                                    </button>
                                    <button
                                        onClick={() => onUpdateClip(selectedClip.id, { overlayX: 100, overlayY: 100 })}
                                        className="text-[10px] bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 py-1 rounded transition-colors"
                                    >
                                        Top-Left
                                    </button>
                                    <button
                                        onClick={() => onUpdateClip(selectedClip.id, { overlayX: 1820, overlayY: 100 })}
                                        className="text-[10px] bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 py-1 rounded transition-colors"
                                    >
                                        Top-Right
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="pt-4 border-t border-gray-800">
                    <button
                        onClick={() => onDeleteClip(selectedClip.id)}
                        className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 py-2 rounded-lg transition-colors font-bold text-sm"
                    >
                        <Trash2 size={16} />
                        Delete Clip
                    </button>
                </div>
            </div>
        </div>
    );
}
