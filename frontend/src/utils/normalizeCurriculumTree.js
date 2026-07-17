function normalizeKey(value) {
    return String(value ?? '').trim().toLowerCase();
}

function dedupeItems(items, getKey, mapItem) {
    const seen = new Set();
    const result = [];

    for (const item of Array.isArray(items) ? items : []) {
        const normalized = mapItem(item);
        const key = getKey(normalized, item);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        result.push(normalized);
    }

    return result;
}

function normalizeSubtopics(subtopics) {
    return dedupeItems(
        subtopics,
        subtopic => normalizeKey(subtopic.id) || normalizeKey(subtopic.name),
        subtopic => ({ ...subtopic })
    );
}

function normalizeTopics(topics) {
    return dedupeItems(
        topics,
        topic => normalizeKey(topic.id) || normalizeKey(topic.name),
        topic => ({
            ...topic,
            subtopics: normalizeSubtopics(topic.subtopics),
        })
    );
}

function normalizeModules(modules) {
    return dedupeItems(
        modules,
        module => normalizeKey(module.id) || normalizeKey(module.name),
        module => ({
            ...module,
            topics: normalizeTopics(module.topics),
        })
    );
}

export function normalizeCurriculumTree(curriculum) {
    if (!curriculum || typeof curriculum !== 'object') return curriculum;

    return {
        ...curriculum,
        modules: normalizeModules(curriculum.modules),
    };
}
