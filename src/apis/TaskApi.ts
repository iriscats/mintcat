import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

type TaskStatus = "Pending" | "Running" | "Completed" | "Failed" | "Canceled";
type TaskOrigin = "Backend" | "Frontend";

export type Task = {
    id: string;
    taskType: string;
    status: TaskStatus;
    progress: number;
    origin: TaskOrigin;
};

export async function addBackendTask(type: string): Promise<Task> {
    const id = await invoke<string>("add_backend_task", { taskType: type });
    return waitForTaskResult(id);
}

export async function addFrontendTask(type: string): Promise<Task> {
    const id = await invoke<string>("add_frontend_task", { taskType: type });

    // 执行逻辑
    (async () => {
        for (let i = 0; i <= 100; i++) {
            await new Promise((r) => setTimeout(r, 30));

            // 每次更新时检查是否已取消
            const tasks = await listTasks();
            const t = tasks.find((x) => x.id === id);
            if (t && t.status === "Canceled") {
                await invoke("update_frontend_task", {
                    task: {
                        id,
                        taskType: type,
                        origin: "Frontend",
                        status: "Canceled",
                        progress: i,
                    },
                });
                return;
            }

            await invoke("update_frontend_task", {
                task: {
                    id,
                    taskType: type,
                    origin: "Frontend",
                    status: "Running",
                    progress: i,
                },
            });
        }

        await invoke("update_frontend_task", {
            task: {
                id,
                taskType: type,
                origin: "Frontend",
                status: "Completed",
                progress: 100,
            },
        });
    })();

    return waitForTaskResult(id);
}

async function waitForTaskResult(id: string): Promise<Task> {
    return new Promise<Task>(async (resolve) => {
        const unlisten = await listen<Task>("task_event", (event) => {
            const task = event.payload;
            if (task.id === id) {
                if (
                    task.status === "Completed" ||
                    task.status.startsWith("Failed") ||
                    task.status === "Canceled"
                ) {
                    unlisten();
                    resolve(task);
                }
            }
        });
    });
}

export async function listTasks(): Promise<Task[]> {
    return await invoke<Task[]>("list_tasks");
}

export async function cancelTask(id: string) {
    await invoke("cancel_task", { taskId: id });
}
