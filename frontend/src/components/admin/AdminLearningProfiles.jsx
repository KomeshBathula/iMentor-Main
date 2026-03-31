import React, { useEffect, useState } from 'react';
import { Loader2, Search, RefreshCw, Brain } from 'lucide-react';
import * as adminApi from '../../services/adminApi.js';
import Button from '../core/Button.jsx';
import toast from 'react-hot-toast';

function LearningProfileCard({ profile }) {
    const { user, hasProfile, learningProfile, summary, knowledgeSummary, lastUpdated } = profile;

    return (
        <div className="p-4 border border-border-light dark:border-border-dark rounded-lg bg-surface-light dark:bg-surface-dark space-y-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="font-semibold text-text-light dark:text-text-dark">{user.name || user.username || 'Student'}</h3>
                    <p className="text-xs text-text-muted-light dark:text-text-muted-dark">{user.email}</p>
                </div>
                <span className={`text-[10px] px-2 py-1 rounded-full ${hasProfile ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'}`}>
                    {hasProfile ? 'Profile Available' : 'No Profile Yet'}
                </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                <div className="p-2 rounded bg-background-light dark:bg-background-dark"><span className="block text-text-muted-light dark:text-text-muted-dark">Concepts</span><strong>{summary?.totalConcepts || 0}</strong></div>
                <div className="p-2 rounded bg-background-light dark:bg-background-dark"><span className="block text-text-muted-light dark:text-text-muted-dark">Mastered</span><strong>{summary?.mastered || 0}</strong></div>
                <div className="p-2 rounded bg-background-light dark:bg-background-dark"><span className="block text-text-muted-light dark:text-text-muted-dark">Struggling</span><strong>{summary?.struggling || 0}</strong></div>
                <div className="p-2 rounded bg-background-light dark:bg-background-dark"><span className="block text-text-muted-light dark:text-text-muted-dark">Insights</span><strong>{summary?.sessionInsights || 0}</strong></div>
                <div className="p-2 rounded bg-background-light dark:bg-background-dark"><span className="block text-text-muted-light dark:text-text-muted-dark">Patterns</span><strong>{summary?.recurringStruggles || 0}</strong></div>
            </div>

            <div className="text-xs text-text-muted-light dark:text-text-muted-dark grid grid-cols-1 md:grid-cols-2 gap-2">
                <p><span className="font-medium">Style:</span> {learningProfile?.dominantLearningStyle || 'unknown'}</p>
                <p><span className="font-medium">Pace:</span> {learningProfile?.learningPace || 'moderate'}</p>
            </div>

            {knowledgeSummary ? (
                <p className="text-sm text-text-light dark:text-text-dark border-l-2 border-primary/40 pl-3">{knowledgeSummary}</p>
            ) : (
                <p className="text-xs italic text-text-muted-light dark:text-text-muted-dark">No knowledge summary yet.</p>
            )}

            <p className="text-[11px] text-text-muted-light dark:text-text-muted-dark">Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : 'N/A'}</p>
        </div>
    );
}

export default function AdminLearningProfiles() {
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalStudents, setTotalStudents] = useState(0);
    const [selectedProfile, setSelectedProfile] = useState(null);
    const [selectedLoading, setSelectedLoading] = useState(false);

    const fetchProfiles = async () => {
        setLoading(true);
        try {
            const response = await adminApi.getLearningProfiles({ page, limit: 20, search });
            setProfiles(Array.isArray(response?.profiles) ? response.profiles : []);
            setTotalPages(response?.totalPages || 1);
            setTotalStudents(response?.totalStudents || 0);
        } catch (error) {
            toast.error(error.message || 'Failed to load learning profiles');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfiles();
    }, [page, search]);

    const submitSearch = (event) => {
        event.preventDefault();
        setPage(1);
        setSearch(searchInput.trim());
    };

    const handleOpenDetails = async (userId) => {
        setSelectedLoading(true);
        try {
            const detail = await adminApi.getLearningProfileDetails(userId);
            setSelectedProfile(detail);
        } catch (error) {
            toast.error(error.message || 'Failed to load profile details');
        } finally {
            setSelectedLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2"><Brain size={18} className="text-primary" /> Student Learning Profiles</h2>
                    <p className="text-xs text-text-muted-light dark:text-text-muted-dark">Read-only visibility for contextual memory profiles. No write/update actions are performed here.</p>
                </div>
                <Button variant="secondary" size="sm" onClick={fetchProfiles} leftIcon={<RefreshCw size={14} />}>Refresh</Button>
            </div>

            <form onSubmit={submitSearch} className="flex gap-2">
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted-light dark:text-text-muted-dark" />
                    <input
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="input-field w-full pl-9"
                        placeholder="Search by email, username, or name"
                    />
                </div>
                <Button type="submit" size="sm">Search</Button>
            </form>

            <p className="text-xs text-text-muted-light dark:text-text-muted-dark">Total students: {totalStudents}</p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-3 max-h-[65vh] overflow-y-auto custom-scrollbar pr-1">
                    {loading ? (
                        <div className="flex items-center justify-center p-10">
                            <Loader2 size={20} className="animate-spin text-primary mr-2" />
                            Loading learning profiles...
                        </div>
                    ) : profiles.length === 0 ? (
                        <div className="p-8 text-center text-sm text-text-muted-light dark:text-text-muted-dark border border-dashed border-border-light dark:border-border-dark rounded-lg">
                            No learning profiles found.
                        </div>
                    ) : (
                        profiles.map((profile) => (
                            <div key={profile.user.id} className="space-y-2">
                                <LearningProfileCard profile={profile} />
                                <Button size="sm" variant="secondary" onClick={() => handleOpenDetails(profile.user.id)}>
                                    View Full Profile
                                </Button>
                            </div>
                        ))
                    )}
                </div>

                <div className="border border-border-light dark:border-border-dark rounded-lg bg-surface-light dark:bg-surface-dark p-4 max-h-[65vh] overflow-y-auto custom-scrollbar">
                    {selectedLoading ? (
                        <div className="flex items-center justify-center p-10">
                            <Loader2 size={20} className="animate-spin text-primary mr-2" />
                            Loading full profile...
                        </div>
                    ) : !selectedProfile ? (
                        <div className="text-sm text-text-muted-light dark:text-text-muted-dark text-center py-12">
                            Select a student to see full learning details.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="border-b border-border-light dark:border-border-dark pb-3">
                                <h3 className="font-semibold text-lg">{selectedProfile.user?.name || selectedProfile.user?.username || 'Student'}</h3>
                                <p className="text-xs text-text-muted-light dark:text-text-muted-dark">{selectedProfile.user?.email}</p>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                <div className="p-2 rounded bg-background-light dark:bg-background-dark"><span className="block text-text-muted-light dark:text-text-muted-dark">Total</span><strong>{selectedProfile.summary?.totalConcepts || 0}</strong></div>
                                <div className="p-2 rounded bg-background-light dark:bg-background-dark"><span className="block text-text-muted-light dark:text-text-muted-dark">Mastered</span><strong>{selectedProfile.summary?.mastered || 0}</strong></div>
                                <div className="p-2 rounded bg-background-light dark:bg-background-dark"><span className="block text-text-muted-light dark:text-text-muted-dark">Learning</span><strong>{selectedProfile.summary?.learning || 0}</strong></div>
                                <div className="p-2 rounded bg-background-light dark:bg-background-dark"><span className="block text-text-muted-light dark:text-text-muted-dark">Struggling</span><strong>{selectedProfile.summary?.struggling || 0}</strong></div>
                            </div>

                            <div className="text-xs space-y-1">
                                <p><span className="font-medium">Style:</span> {selectedProfile.profile?.dominantLearningStyle || 'unknown'}</p>
                                <p><span className="font-medium">Pace:</span> {selectedProfile.profile?.learningPace || 'moderate'}</p>
                                <p><span className="font-medium">Depth:</span> {selectedProfile.profile?.preferredDepth || 'balanced'}</p>
                                <p><span className="font-medium">Challenge Response:</span> {selectedProfile.profile?.challengeResponse || 'needs_encouragement'}</p>
                                <p><span className="font-medium">Questioning:</span> {selectedProfile.profile?.questioningBehavior || 'asks_when_stuck'}</p>
                            </div>

                            <div>
                                <h4 className="text-sm font-semibold mb-1">Knowledge Summary</h4>
                                <p className="text-sm border-l-2 border-primary/40 pl-3">{selectedProfile.textSummary || 'No summary available.'}</p>
                            </div>

                            <div>
                                <h4 className="text-sm font-semibold mb-1">Current Focus Areas</h4>
                                <div className="space-y-1">
                                    {(selectedProfile.currentFocusAreas || []).length === 0 ? (
                                        <p className="text-xs text-text-muted-light dark:text-text-muted-dark">None</p>
                                    ) : (
                                        (selectedProfile.currentFocusAreas || []).map((focus, idx) => (
                                            <p key={idx} className="text-xs">• {focus.topic} ({focus.priority || 'medium'})</p>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div>
                                <h4 className="text-sm font-semibold mb-1">Concepts</h4>
                                <div className="max-h-40 overflow-y-auto custom-scrollbar border border-border-light dark:border-border-dark rounded">
                                    <table className="w-full text-xs">
                                        <thead className="bg-background-light dark:bg-background-dark sticky top-0">
                                            <tr>
                                                <th className="text-left p-2">Concept</th>
                                                <th className="text-left p-2">Mastery</th>
                                                <th className="text-left p-2">Level</th>
                                                <th className="text-left p-2">Difficulty</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(selectedProfile.concepts || []).map((concept, idx) => (
                                                <tr key={`${concept.name}-${idx}`} className="border-t border-border-light dark:border-border-dark">
                                                    <td className="p-2">{concept.name}</td>
                                                    <td className="p-2">{concept.mastery}%</td>
                                                    <td className="p-2">{concept.understandingLevel}</td>
                                                    <td className="p-2">{concept.difficulty}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-sm font-semibold mb-1">Recurring Struggles</h4>
                                <div className="space-y-1">
                                    {(selectedProfile.recurringStruggles || []).length === 0 ? (
                                        <p className="text-xs text-text-muted-light dark:text-text-muted-dark">None</p>
                                    ) : (
                                        (selectedProfile.recurringStruggles || []).map((entry, idx) => (
                                            <p key={idx} className="text-xs">• {entry.pattern} ({entry.occurrences || 0} times)</p>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div>
                                <h4 className="text-sm font-semibold mb-1">Session Insights</h4>
                                <div className="space-y-2 max-h-36 overflow-y-auto custom-scrollbar">
                                    {(selectedProfile.sessionInsights || []).length === 0 ? (
                                        <p className="text-xs text-text-muted-light dark:text-text-muted-dark">None</p>
                                    ) : (
                                        (selectedProfile.sessionInsights || []).map((session, idx) => (
                                            <div key={idx} className="p-2 rounded border border-border-light dark:border-border-dark text-xs">
                                                <p className="font-medium">Session: {session.sessionId || 'N/A'}</p>
                                                <p>Covered: {(session.conceptsCovered || []).join(', ') || 'N/A'}</p>
                                                <p>Struggled: {(session.struggledWith || []).join(', ') || 'N/A'}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div>
                                <h4 className="text-sm font-semibold mb-1">Course Progress</h4>
                                <div className="space-y-1 text-xs">
                                    {(selectedProfile.courseCurriculumProgress || []).length === 0 ? (
                                        <p className="text-text-muted-light dark:text-text-muted-dark">No course progress yet.</p>
                                    ) : (
                                        (selectedProfile.courseCurriculumProgress || []).map((course, idx) => (
                                            <p key={idx}>• {course.courseName}: {course.completedSubtopics?.length || 0} subtopics, {course.completedTopics?.length || 0} topics completed</p>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-between pt-2">
                <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Previous</Button>
                <span className="text-xs text-text-muted-light dark:text-text-muted-dark">Page {page} / {Math.max(totalPages, 1)}</span>
                <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((prev) => prev + 1)}>Next</Button>
            </div>
        </div>
    );
}
