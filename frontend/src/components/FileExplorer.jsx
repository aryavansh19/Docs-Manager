import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Folder, FileText, ChevronRight, Loader2, Download, Eye, ArrowLeft } from 'lucide-react';

const FileExplorer = ({ rootFolderId }) => {
    // History Stack for Breadcrumbs (starts with Root)
    const [history, setHistory] = useState([{ id: rootFolderId, name: 'Home' }]);
    const [currentFolder, setCurrentFolder] = useState(rootFolderId);

    const [content, setContent] = useState({ folders: [], files: [] });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Fetch data whenever currentFolder changes
    useEffect(() => {
        if (!currentFolder) return;

        setLoading(true);
        setError(null);

        axios.get(`http://localhost:8001/api/drive/browse?folder_id=${currentFolder}`, { withCredentials: true })
            .then(res => {
                setContent({
                    folders: res.data.folders || [],
                    files: res.data.files || []
                });
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setError("Failed to load folder content.");
                setLoading(false);
            });
    }, [currentFolder]);

    // Handle Folder Click (Drill Down)
    const handleEnterFolder = (folder) => {
        setHistory([...history, { id: folder.id, name: folder.name }]);
        setCurrentFolder(folder.id);
    };

    // Handle Breadcrumb Click (Go Back)
    const handleBreadcrumbClick = (index) => {
        const newHistory = history.slice(0, index + 1);
        setHistory(newHistory);
        setCurrentFolder(newHistory[newHistory.length - 1].id);
    };

    return (
        <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 min-h-[500px]">

            {/* 1. Breadcrumb Navigation */}
            <div className="flex items-center gap-2 mb-6 text-sm text-slate-400 overflow-x-auto pb-2">
                {history.map((item, index) => (
                    <div key={item.id} className="flex items-center whitespace-nowrap">
                        <span
                            onClick={() => handleBreadcrumbClick(index)}
                            className={`cursor-pointer hover:text-white transition-colors ${index === history.length - 1 ? "text-blue-400 font-bold" : ""}`}
                        >
                            {item.name}
                        </span>
                        {index < history.length - 1 && <ChevronRight size={14} className="mx-1 opacity-50" />}
                    </div>
                ))}
            </div>

            {/* 2. Loading State */}
            {loading && (
                <div className="h-64 flex flex-col items-center justify-center text-slate-500">
                    <Loader2 className="animate-spin mb-2" />
                    <p>Fetching files from Drive...</p>
                </div>
            )}

            {/* 3. Error State */}
            {error && !loading && (
                <div className="text-red-400 p-4 border border-red-500/20 bg-red-500/5 rounded-lg text-center">
                    {error}
                </div>
            )}

            {/* 4. Content Grid */}
            {!loading && !error && (
                <div className="space-y-8">

                    {/* FOLDERS SECTION */}
                    {content.folders.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Folders</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {content.folders.map(folder => (
                                    <div
                                        key={folder.id}
                                        onClick={() => handleEnterFolder(folder)}
                                        className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-blue-500/50 cursor-pointer transition-all group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 group-hover:text-blue-300">
                                                <Folder size={20} />
                                            </div>
                                            <span className="font-medium truncate text-sm">{folder.name}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* FILES SECTION */}
                    {content.files.length > 0 ? (
                        <div>
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Files</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {content.files.map(file => (
                                    <div key={file.id} className="p-3 bg-white/5 border border-white/5 rounded-lg flex items-center justify-between group hover:border-white/20 transition-colors">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <FileText size={18} className="text-slate-400 flex-shrink-0" />
                                            <span className="text-sm truncate text-slate-200">{file.name}</span>
                                        </div>

                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <a
                                                href={file.webViewLink}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="p-2 hover:bg-white/10 rounded text-slate-400 hover:text-white"
                                                title="Preview"
                                            >
                                                <Eye size={16} />
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* Empty State (Only show if no folders either) */
                        content.folders.length === 0 && (
                            <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-2xl">
                                <p className="text-slate-500">This folder is empty.</p>
                                <p className="text-xs text-slate-600 mt-1">Upload a file via WhatsApp to see it here.</p>
                            </div>
                        )
                    )}
                </div>
            )}
        </div>
    );
};

export default FileExplorer;