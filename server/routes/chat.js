// server/routes/chat.js
// Re-exports the decomposed chat router from routes/chat/.
// Node resolves require('./routes/chat') to this file (file beats directory),
// so server.js needs no changes.
module.exports = require('./chat/index');
