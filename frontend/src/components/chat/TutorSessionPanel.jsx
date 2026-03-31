import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api.js';
import './TutorSessionPanel.css';

/**
 * Tutor Session Panel Component
 * Displays learning progress, knowledge gaps, adaptive scaffolding info,
 * and live curriculum progress fetched from the server.
 */
const TutorSessionPanel = ({ tutorSessionData }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [curriculumProgress, setCurriculumProgress] = useState(null);
    const prevCourseRef = useRef(null);

    // Fetch curriculum progress whenever the active course changes
    useEffect(() => {
        const course = tutorSessionData?.courseName;
        if (!course || course === 'General' || course === prevCourseRef.current) return;
        prevCourseRef.current = course;

        api.getTutorProgress(course)
            .then(data => {
                if (data?.success) {
                    setCurriculumProgress({
                        completedSubtopics: data.completedSubtopics?.length || 0,
                        completedTopics: data.completedTopics?.length || 0,
                        totalSubtopics: data.totalSubtopics || 0,
                        totalTopics: data.totalTopics || 0,
                        currentModule: data.position?.moduleName,
                        currentTopic: data.position?.topicName,
                        currentSubtopic: data.position?.subtopicName,
                    });
                }
            })
            .catch(() => { /* non-critical */ });
    }, [tutorSessionData?.courseName]);

    if (!tutorSessionData) return null;

    const {
        learningGoal,
        studentLevel,
        knowledgeGaps = [],
        progressTracking = {},
        comprehensionLevel,
        tutorSessionId,
        masteryProgress,
    } = tutorSessionData;

    const unresolvedGaps = knowledgeGaps.filter(gap => !gap.resolved);
    const resolvedGaps = knowledgeGaps.filter(gap => gap.resolved);

    const comprehensionPercent = comprehensionLevel
        ? Math.round(comprehensionLevel * 100)
        : null;

    const masteryPercent = masteryProgress
        ? Math.round(((masteryProgress.current || 0) / (masteryProgress.required || 3.5)) * 100)
        : null;

    const curriculumPercent = curriculumProgress?.totalSubtopics > 0
        ? Math.round((curriculumProgress.completedSubtopics / curriculumProgress.totalSubtopics) * 100)
        : null;

    const getLevelBadgeColor = (level) => {
        const colors = {
            'beginner': '#ff6b6b',
            'intermediate': '#ffd93d',
            'advanced': '#6bcf7f'
        };
        return colors[level] || '#95a5a6';
    };

    return (
        <div className="tutor-session-panel">
            <div className="panel-header" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="header-left">
                    <span className="panel-icon">🎓</span>
                    <h3>Tutor Mode Active</h3>
                </div>
                <button className="expand-btn">
                    {isExpanded ? '▼' : '▶'}
                </button>
            </div>

            {isExpanded && (
                <div className="panel-content">
                    {/* Learning Goal */}
                    <div className="info-section">
                        <div className="section-label">Learning Goal</div>
                        <div className="section-value goal-text">{learningGoal}</div>
                    </div>

                    {/* Student Level */}
                    <div className="info-section">
                        <div className="section-label">Student Level</div>
                        <span
                            className="level-badge"
                            style={{ backgroundColor: getLevelBadgeColor(studentLevel) }}
                        >
                            {(studentLevel || 'unknown').toUpperCase()}
                        </span>
                    </div>

                    {/* Curriculum Progress */}
                    {curriculumProgress && curriculumPercent !== null && (
                        <div className="info-section">
                            <div className="section-label">
                                📚 Curriculum Progress
                                {curriculumProgress.currentModule && (
                                    <span style={{ fontWeight: 400, marginLeft: 4, fontSize: '0.75em' }}>
                                        — {curriculumProgress.currentModule}
                                    </span>
                                )}
                            </div>
                            <div className="comprehension-bar" title={`${curriculumProgress.completedSubtopics} / ${curriculumProgress.totalSubtopics} subtopics`}>
                                <div
                                    className="comprehension-fill"
                                    style={{
                                        width: `${Math.min(curriculumPercent, 100)}%`,
                                        backgroundColor: '#6bcf7f'
                                    }}
                                />
                                <span className="comprehension-label">
                                    {curriculumProgress.completedSubtopics}/{curriculumProgress.totalSubtopics} subtopics ({curriculumPercent}%)
                                </span>
                            </div>
                            {curriculumProgress.currentTopic && (
                                <div style={{ fontSize: '0.75em', marginTop: 2, opacity: 0.75 }}>
                                    Now: {curriculumProgress.currentTopic}
                                    {curriculumProgress.currentSubtopic && curriculumProgress.currentSubtopic !== curriculumProgress.currentTopic
                                        ? ` › ${curriculumProgress.currentSubtopic}`
                                        : ''}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Mastery Progress (from tutor AI response) */}
                    {masteryPercent !== null && (
                        <div className="info-section">
                            <div className="section-label">🎯 Topic Mastery</div>
                            <div className="comprehension-bar" title={`${masteryProgress.current?.toFixed(1)} / ${masteryProgress.required} mastery score`}>
                                <div
                                    className="comprehension-fill"
                                    style={{
                                        width: `${Math.min(masteryPercent, 100)}%`,
                                        backgroundColor: masteryPercent >= 80 ? '#6bcf7f' :
                                            masteryPercent >= 50 ? '#ffd93d' : '#ff6b6b'
                                    }}
                                />
                                <span className="comprehension-label">{masteryPercent}%</span>
                            </div>
                        </div>
                    )}

                    {/* Comprehension */}
                    {comprehensionPercent !== null && (
                        <div className="info-section">
                            <div className="section-label">Current Comprehension</div>
                            <div className="comprehension-bar">
                                <div
                                    className="comprehension-fill"
                                    style={{
                                        width: `${comprehensionPercent}%`,
                                        backgroundColor: comprehensionPercent > 70 ? '#6bcf7f' :
                                            comprehensionPercent > 40 ? '#ffd93d' : '#ff6b6b'
                                    }}
                                />
                                <span className="comprehension-label">{comprehensionPercent}%</span>
                            </div>
                        </div>
                    )}

                    {/* Knowledge Gaps */}
                    {unresolvedGaps.length > 0 && (
                        <div className="info-section">
                            <div className="section-label">Working On:</div>
                            <div className="gaps-list">
                                {unresolvedGaps.map((gap, index) => (
                                    <div key={index} className="gap-item unresolved">
                                        <span className="gap-icon">⚠️</span>
                                        <span className="gap-text">{gap.concept || gap}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Understood Concepts */}
                    {progressTracking.conceptsUnderstood?.length > 0 && (
                        <div className="info-section">
                            <div className="section-label">✅ Understood:</div>
                            <div className="concepts-list">
                                {progressTracking.conceptsUnderstood.map((concept, index) => (
                                    <span key={index} className="concept-tag understood">
                                        {concept}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Progress Stats */}
                    <div className="stats-grid">
                        <div className="stat-box">
                            <div className="stat-value">{progressTracking.totalInteractions || 0}</div>
                            <div className="stat-label">Interactions</div>
                        </div>
                        <div className="stat-box">
                            <div className="stat-value">{progressTracking.successfulGuidance || 0}</div>
                            <div className="stat-label">Helpful Hints</div>
                        </div>
                        <div className="stat-box">
                            <div className="stat-value">{resolvedGaps.length}</div>
                            <div className="stat-label">Gaps Resolved</div>
                        </div>
                    </div>

                    {/* Session ID (for debugging) */}
                    <div className="session-id">
                        Session ID: {tutorSessionId?.toString().substring(0, 8)}...
                    </div>
                </div>
            )}
        </div>
    );
};

export default TutorSessionPanel;
