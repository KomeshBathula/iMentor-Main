# iMentor Web Server - Three Terminal Setup

## STEP 0: Cleanup (Run this FIRST!)

```bash
cd /home/sri/Downloads/iMentor_march/chatbot
./cleanup-all.sh
```

Wait for cleanup to complete, then open 3 separate terminals.

---

## TERMINAL 1: Docker + Server Backend

```bash
# Navigate to project directory
cd /home/sri/Downloads/iMentor_march/chatbot

# Start Docker infrastructure (MongoDB, Redis, Neo4j, Qdrant, etc.)
docker compose up -d mongo redis neo4j qdrant elasticsearch ollama sglang rag

# Wait for containers to be healthy (30-60 seconds)
echo "Waiting for Docker containers..."
sleep 30

# Check Docker status
docker ps --filter "name=imentor" --format "{{.Names}}: {{.Status}}"

# Start Node.js server
cd server
node server.js
```

**Keep this terminal open!** You should see:
- `✓ MongoDB Connected`
- `✓ Redis connected successfully`
- `✓ Neo4j connected successfully`
- `Server running on port 5001`

---

## TERMINAL 2: Frontend (React/Vite)

**Wait until Terminal 1 shows "Server running on port 5001" before starting this!**

```bash
# Navigate to frontend directory
cd /home/sri/Downloads/iMentor_march/chatbot/frontend

# Install dependencies (if needed)
npm install

# Start Vite development server
npm run dev
```

**Keep this terminal open!** You should see:
- `➜  Local:   http://localhost:3000/`
- `➜  ready in XXXms`

---

## TERMINAL 3: Monitor & Testing (Optional)

**Wait until both services are running before starting this!**

```bash
# Navigate to project directory  
cd /home/sri/Downloads/iMentor_march/chatbot

# Start monitoring script
./monitor.sh

# OR run tests (after web app is working)
# npm test
```

---

## Verification Steps

After all terminals are running:

1. **Check services are accessible:**
   ```bash
   curl http://localhost:5001/health    # Should return server health
   curl http://localhost:3000           # Should return HTML page
   curl http://localhost:2001/health    # Should return RAG service health
   ```

2. **Open browser:** http://localhost:3000

3. **Login with:** 
   - Email: `ultra.boy7@gmail.com`
   - Password: `123456`

4. **Test features:**
   - Chat functionality
   - Tutor mode
   - Skill tree

---

## Troubleshooting

### If you get 401 errors:
- Make sure Terminal 1 (server) is running on port 5001
- Check that Docker containers are all healthy
- Restart the frontend (Terminal 2) after server is ready

### If frontend won't load:
- Check that port 3000 is free
- Make sure you ran cleanup first
- Restart Vite with `npm run dev`

### If API calls fail:
- Verify server is on port 5001: `lsof -i :5001`
- Check server logs in Terminal 1
- Test API directly: `curl http://localhost:5001/api/health`

### Common ports used:
- `3000` - Frontend (Vite)
- `5001` - Backend API (Node.js)
- `2001` - RAG Service (Docker)
- `8000` - SGLang LLM (Docker)
- `11434` - Ollama (Docker)
- `27017` - MongoDB (Docker)
- `6379` - Redis (Docker)
- `7687` - Neo4j (Docker)
- `6333` - Qdrant (Docker)