# MCP Bitrix24 Tasks

MCP server for fetching active Bitrix24 tasks with comments via Claude Code.

## Features

- **get_my_tasks** - Fetches all active tasks assigned to you (statuses: Pending, In Progress, Supposedly Completed, Deferred) with all comments included

## Setup

```bash
npm install
npm run build
```

## Claude Code Configuration

Add to your MCP settings (`~/.claude.json` or Claude Desktop config):

```json
{
  "mcpServers": {
    "bitrix24-tasks": {
      "command": "node",
      "args": ["D:\\Projects\\mcp_bitrix24_tasks\\dist\\index.js"],
      "env": {
        "BITRIX_WEBHOOK_URL": "https://your-domain.bitrix24.com/rest/{user_id}/{webhook_token}",
        "BITRIX_USER_ID": "your_user_id"
      }
    }
  }
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `BITRIX_WEBHOOK_URL` | Bitrix24 webhook URL (e.g., `https://company.bitrix24.com/rest/1/abc123`) |
| `BITRIX_USER_ID` | Your Bitrix24 user ID for filtering tasks |

## API Endpoints Used

- `tasks.task.list` - Get tasks list
- `task.commentitem.getlist` - Get task comments
