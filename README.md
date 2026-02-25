# @jsondb-cloud/mcp

The official MCP (Model Context Protocol) server for [jsondb.cloud](https://jsondb.cloud) — a hosted JSON document database. Lets AI agents create, query, and manage documents through natural language.

[![npm version](https://img.shields.io/npm/v/@jsondb-cloud/mcp)](https://www.npmjs.com/package/@jsondb-cloud/mcp)
[![npm downloads](https://img.shields.io/npm/dm/@jsondb-cloud/mcp)](https://www.npmjs.com/package/@jsondb-cloud/mcp)
[![CI](https://github.com/JsonDBCloud/mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/JsonDBCloud/mcp/actions)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Install

```bash
npm install @jsondb-cloud/mcp
```

## Usage

Once configured, ask your AI assistant:

> List all collections in my database

> Create a document in "users" with name "Alice" and role "admin"

> Find all users where role is "admin"

> Show me version history for document abc123 in "orders"

> Set up a webhook on "orders" that fires on document.created

## Configuration

You need a jsondb.cloud API key. Get one from your [dashboard](https://jsondb.cloud).

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "jsondb": {
      "command": "npx",
      "args": ["-y", "@jsondb-cloud/mcp"],
      "env": {
        "JSONDB_API_KEY": "jdb_sk_live_..."
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add jsondb -- npx -y @jsondb-cloud/mcp \
  --env JSONDB_API_KEY=jdb_sk_live_...
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "jsondb": {
      "command": "npx",
      "args": ["-y", "@jsondb-cloud/mcp"],
      "env": {
        "JSONDB_API_KEY": "jdb_sk_live_..."
      }
    }
  }
}
```

### Environment Variables

| Variable          | Required | Default                    | Description                                      |
| ----------------- | -------- | -------------------------- | ------------------------------------------------ |
| `JSONDB_API_KEY`  | Yes      | —                          | API key (`jdb_sk_live_...` or `jdb_sk_test_...`) |
| `JSONDB_PROJECT`  | No       | `v1`                       | Project namespace                                |
| `JSONDB_BASE_URL` | No       | `https://api.jsondb.cloud` | API base URL                                     |

## Tools

### Documents

| Tool                  | Description                                            |
| --------------------- | ------------------------------------------------------ |
| `create_document`     | Create a new document in a collection                  |
| `get_document`        | Read a single document by ID                           |
| `list_documents`      | List documents with filtering, sorting, and pagination |
| `update_document`     | Replace a document entirely                            |
| `patch_document`      | Partially update a document (merge patch)              |
| `delete_document`     | Delete a document by ID                                |
| `count_documents`     | Count documents matching an optional filter            |
| `json_patch_document` | Apply RFC 6902 JSON Patch operations                   |

### Collections

| Tool                | Description                                                        |
| ------------------- | ------------------------------------------------------------------ |
| `list_collections`  | List all collections in the current project                        |
| `search_documents`  | Search with advanced filters (`eq`, `gt`, `contains`, `in`, etc.)  |
| `import_documents`  | Bulk import with conflict resolution (`fail`, `skip`, `overwrite`) |
| `export_collection` | Export all documents as JSON                                       |

### Schemas

| Tool                | Description                                     |
| ------------------- | ----------------------------------------------- |
| `get_schema`        | Get the JSON Schema for a collection            |
| `set_schema`        | Set a JSON Schema to enforce document structure |
| `remove_schema`     | Remove schema validation from a collection      |
| `validate_document` | Dry-run validate a document against the schema  |

### Versions

| Tool              | Description                                 |
| ----------------- | ------------------------------------------- |
| `list_versions`   | List all stored versions of a document      |
| `get_version`     | Retrieve a specific version snapshot        |
| `restore_version` | Restore a document to a previous version    |
| `diff_versions`   | Compare two versions with a structured diff |

### Webhooks

| Tool             | Description                                     |
| ---------------- | ----------------------------------------------- |
| `create_webhook` | Register a webhook for collection events        |
| `list_webhooks`  | List all webhooks for a collection              |
| `get_webhook`    | Get webhook details and recent delivery history |
| `update_webhook` | Update webhook URL, events, or status           |
| `delete_webhook` | Delete a webhook                                |
| `test_webhook`   | Send a test event to verify delivery            |

## Documentation

Full documentation at [jsondb.cloud/docs](https://jsondb.cloud/docs).

## Related Packages

| Package                                                      | Description               |
| ------------------------------------------------------------ | ------------------------- |
| [@jsondb-cloud/client](https://github.com/JsonDBCloud/node)  | JavaScript/TypeScript SDK |
| [@jsondb-cloud/mcp](https://github.com/JsonDBCloud/mcp)      | MCP server for AI agents  |
| [@jsondb-cloud/cli](https://github.com/JsonDBCloud/cli)      | CLI tool                  |
| [jsondb-cloud](https://github.com/JsonDBCloud/python) (PyPI) | Python SDK                |

## License

MIT
