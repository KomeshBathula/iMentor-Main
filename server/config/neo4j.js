// server/config/neo4j.js
/**
 * Neo4j Configuration for Node.js Backend
 * Provides a safe wrapper around neo4j-driver with graceful fallback when Neo4j is unavailable.
 */

const log = require('../utils/logger');

let driver = null;
let isConnected = false;

// Try to initialize Neo4j driver if environment variables are set
const initializeNeo4j = async () => {
    const uri = process.env.NEO4J_URI;
    const user = process.env.NEO4J_USER;
    const password = process.env.NEO4J_PASSWORD;

    if (!uri || !user || !password) {
        log.warn('DB', 'Neo4j not configured - graph features disabled');
        return false;
    }

    try {
        // Try to load neo4j-driver (optional dependency)
        let neo4jDriver;
        try {
            neo4jDriver = require('neo4j-driver');
        } catch (e) {
            log.warn('DB', 'neo4j-driver package not installed');
            return false;
        }

        driver = neo4jDriver.driver(uri, neo4jDriver.auth.basic(user, password));

        // Verify connectivity
        await driver.verifyConnectivity();
        isConnected = true;
        log.success('DB', 'Neo4j connection established');

        // Ensure composite indexes for hot MERGE paths
        const session = driver.session();
        try {
            await session.run('CREATE INDEX module_id_course IF NOT EXISTS FOR (m:Module) ON (m.id, m.course)');
            await session.run('CREATE INDEX topic_id_course IF NOT EXISTS FOR (t:Topic) ON (t.id, t.course)');
            await session.run('CREATE INDEX subtopic_id_course IF NOT EXISTS FOR (s:Subtopic) ON (s.id, s.course)');
        } catch (idxErr) {
            log.warn('DB', `Neo4j index setup warning: ${idxErr.message}`);
        } finally {
            await session.close();
        }

        return true;
    } catch (error) {
        log.warn('DB', `Neo4j connection failed: ${error.message}`);
        driver = null;
        isConnected = false;
        return false;
    }
};

/**
 * Run a Cypher query against Neo4j
 * Returns empty result if Neo4j is not available (graceful degradation)
 */
const runQuery = async (query, params = {}) => {
    if (!driver || !isConnected) {
        // Graceful fallback - return empty result instead of throwing
        return { records: [] };
    }

    const session = driver.session();
    try {
        const result = await session.run(query, params);
        return result;
    } catch (error) {
        log.error('DB', `Neo4j query error: ${error.message}`);
        throw error;
    } finally {
        await session.close();
    }
};

/**
 * Close the Neo4j connection
 */
const closeConnection = async () => {
    if (driver) {
        await driver.close();
        driver = null;
        isConnected = false;
        log.info('DB', 'Neo4j connection closed');
    }
};

// Initialize on module load (non-blocking)
initializeNeo4j().catch(() => {
    // Silently ignore - already logged in initializeNeo4j
});

module.exports = {
    runQuery,
    closeConnection,
    initializeNeo4j,
    isConnected: () => isConnected
};
