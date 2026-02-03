#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const BITRIX_WEBHOOK_URL = process.env.BITRIX_WEBHOOK_URL || "";
const BITRIX_USER_ID = process.env.BITRIX_USER_ID || "602";

interface BitrixComment {
  ID: string;
  AUTHOR_ID: string;
  AUTHOR_NAME: string;
  POST_DATE: string;
  POST_MESSAGE: string;
}

interface TasksApiResponse {
  result: {
    tasks: Array<{
      id: string;
      title: string;
      description: string;
      status: string;
      deadline: string | null;
      groupId: string;
      createdBy: string;
      commentsCount: string;
    }>;
  };
  next?: number;
}

interface CommentsApiResponse {
  result: BitrixComment[];
}

interface FormattedComment {
  id: string;
  authorId: string;
  authorName: string;
  date: string;
  message: string;
}

interface TaskWithComments {
  id: string;
  title: string;
  description: string;
  status: string;
  deadline: string;
  groupId: string;
  createdBy: string;
  comments: FormattedComment[];
}

const STATUS_NAMES: Record<string, string> = {
  "2": "Pending",
  "3": "In Progress",
  "4": "Supposedly Completed",
  "5": "Completed",
  "6": "Deferred",
};

async function fetchTaskComments(taskId: string): Promise<FormattedComment[]> {
  const url = `${BITRIX_WEBHOOK_URL}/task.commentitem.getlist?TASKID=${taskId}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as CommentsApiResponse;
  const comments = data.result || [];

  return comments.map((comment) => ({
    id: comment.ID,
    authorId: comment.AUTHOR_ID,
    authorName: comment.AUTHOR_NAME,
    date: comment.POST_DATE,
    message: comment.POST_MESSAGE,
  }));
}

async function fetchAllTasksWithComments(): Promise<TaskWithComments[]> {
  const allTasks: TaskWithComments[] = [];
  let start = 0;

  while (true) {
    const url = new URL(`${BITRIX_WEBHOOK_URL}/tasks.task.list`);
    url.searchParams.set("filter[RESPONSIBLE_ID]", BITRIX_USER_ID);
    url.searchParams.append("filter[STATUS][]", "2");
    url.searchParams.append("filter[STATUS][]", "3");
    url.searchParams.append("filter[STATUS][]", "4");
    url.searchParams.append("filter[STATUS][]", "6");
    url.searchParams.set("start", start.toString());

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as TasksApiResponse;

    if (data.result && data.result.tasks) {
      for (const task of data.result.tasks) {
        const comments = await fetchTaskComments(task.id);

        allTasks.push({
          id: task.id,
          title: task.title,
          description: task.description || "",
          status: STATUS_NAMES[task.status] || task.status,
          deadline: task.deadline || "No deadline",
          groupId: task.groupId,
          createdBy: task.createdBy,
          comments,
        });
      }
    }

    if (data.next) {
      start = data.next;
    } else {
      break;
    }
  }

  return allTasks;
}

const server = new Server(
  {
    name: "bitrix24-tasks",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_my_tasks",
        description:
          "Fetches all active tasks from Bitrix24 where the user is the assigned person, including all comments for each task. Returns tasks with statuses: Pending, In Progress, Supposedly Completed, and Deferred.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params;

  try {
    if (name === "get_my_tasks") {
      const tasks = await fetchAllTasksWithComments();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                totalTasks: tasks.length,
                tasks,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Unknown tool: ${name}`,
        },
      ],
      isError: true,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return {
      content: [
        {
          type: "text",
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Bitrix24 Tasks MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
