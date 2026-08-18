import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Folder, FileText, ChevronRight, Loader2, Eye, Home } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { API_URL } from '../lib/config';

/**
 * Standalone Drive browser.
 *
 * NOTE: this component is not currently mounted anywhere — Dashboard has its own
 * browser. It is kept in sync with the design system and the authenticated API
 * contract so it works if it is ever wired up.
 */
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

        let cancelled = false;
        setLoading(true);
        setError(null);

        const load = async () => {
            try {
                // The endpoint requires a Supabase bearer token.
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) throw new Error('Not signed in');

                const res = await axios.get(
                    `${API_URL}/api/drive/browse?folder_id=${currentFolder}`,
                    { headers: { Authorization: `Bearer ${session.access_token}` } }
                );

                if (cancelled) return;
                setContent({
                    folders: res.data.folders || [],
                    files: res.data.files || [],
                });
            } catch (err) {
                if (cancelled) return;
                console.error(err);
                setError('Failed to load folder content.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => { cancelled = true; };
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
        <div className="min-h-[500px] rounded-2xl border-2 border-ink bg-paper p-6 shadow-brut">

            {/* 1. Breadcrumb Navigation */}
            <nav aria-label="Breadcrumb" className="mb-6">
                <ol className="scrollbar-hide flex items-center gap-1.5 overflow-x-auto pb-1">
                    {history.map((item, index) => {
                        const isLast = index === history.length - 1;
                        return (
                            <li key={item.id} className="flex shrink-0 items-center gap-1.5">
                                {index > 0 && (
                                    <ChevronRight size={13} className="text-ink-25" aria-hidden="true" />
                                )}
                                <button
                                    type="button"
                                    onClick={() => handleBreadcrumbClick(index)}
                                    aria-current={isLast ? 'page' : undefined}
                                    disabled={isLast}
                                    className={`flex items-center gap-1.5 rounded-full border-2 border-ink px-3 py-1.5 font-mono text-[11px] font-bold transition-colors ${
                                        isLast
                                            ? 'cursor-default bg-ink text-paper'
                                            : 'bg-paper text-ink hover:bg-lime'
                                    }`}
                                >
                                    {index === 0 && <Home size={12} />}
                                    {item.name}
                                </button>
                            </li>
                        );
                    })}
                </ol>
            </nav>

            {/* 2. Loading State */}
            {loading && (
                <div className="flex h-64 items-center justify-center">
                    <span className="flex items-center gap-2.5 rounded-full border-2 border-ink bg-paper px-5 py-2.5">
                        <Loader2 className="animate-spin text-ink" size={15} />
                        <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-ink">
                            Fetching from Drive
                        </span>
                    </span>
                </div>
            )}

            {/* 3. Error State */}
            {error && !loading && (
                <p className="rounded-xl border-2 border-ink bg-flame-soft p-4 text-center text-sm font-bold text-ink">
                    {error}
                </p>
            )}

            {/* 4. Content */}
            {!loading && !error && (
                <div className="space-y-8">

                    {/* FOLDERS SECTION */}
                    {content.folders.length > 0 && (
                        <section>
                            <div className="mb-4 flex items-center gap-4">
                                <h3 className="eyebrow text-ink-45">Folders</h3>
                                <span className="h-0.5 flex-1 bg-ink/10" />
                            </div>
                            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                                {content.folders.map(folder => (
                                    <button
                                        key={folder.id}
                                        type="button"
                                        onClick={() => handleEnterFolder(folder)}
                                        className="card-lift flex items-center gap-3 bg-lime-soft p-4 text-left"
                                    >
                                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border-2 border-ink bg-lime text-ink">
                                            <Folder size={17} />
                                        </span>
                                        <span className="truncate text-sm font-bold text-ink">
                                            {folder.name}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* FILES SECTION */}
                    {content.files.length > 0 ? (
                        <section>
                            <div className="mb-4 flex items-center gap-4">
                                <h3 className="eyebrow text-ink-45">Files</h3>
                                <span className="h-0.5 flex-1 bg-ink/10" />
                            </div>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                {content.files.map(file => (
                                    <div
                                        key={file.id}
                                        className="flex items-center justify-between gap-3 rounded-xl border-2 border-ink bg-paper-2 p-3"
                                    >
                                        <span className="flex min-w-0 items-center gap-3">
                                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border-2 border-ink bg-flame text-paper">
                                                <FileText size={16} />
                                            </span>
                                            <span className="truncate text-sm font-bold text-ink">
                                                {file.name}
                                            </span>
                                        </span>

                                        <a
                                            href={file.webViewLink}
                                            target="_blank"
                                            rel="noreferrer"
                                            title="Preview"
                                            aria-label={`Preview ${file.name}`}
                                            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2 border-ink bg-paper text-ink transition-colors hover:bg-lime"
                                        >
                                            <Eye size={15} />
                                        </a>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ) : (
                        /* Empty State (Only show if no folders either) */
                        content.folders.length === 0 && (
                            <div className="rounded-2xl border-2 border-dashed border-ink/25 py-20 text-center">
                                <p className="font-display text-xl font-extrabold text-ink">
                                    This folder is empty
                                </p>
                                <p className="mt-1.5 text-sm text-ink-45">
                                    Forward a file via WhatsApp to see it here.
                                </p>
                            </div>
                        )
                    )}
                </div>
            )}
        </div>
    );
};

export default FileExplorer;
