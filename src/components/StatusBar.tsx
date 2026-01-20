import { useState, useRef, useEffect } from "react";
import { t } from "i18next";
import { Flex, Progress, ProgressProps } from "antd";
import { emitEvent, useEventListener } from "@/events";
import { taskQueueAPI } from 'tauri-plugin-task-queue-api';

const ProgressColors: ProgressProps['strokeColor'] = {
    '0%': '#108ee9',
    '100%': '#87d068',
};

/**
 * 状态栏组件
 * 显示应用状态消息和进度条
 *
 * 集中管理任务队列监听，作为项目中唯一的任务监听点
 */
function StatusBar() {
    const [message, setMessage] = useState<string>(t("Ready"));
    const [percent, setPercent] = useState<number>(0);
    const timerRef = useRef<NodeJS.Timeout | undefined>(undefined);

    // ✅ 自动清理的状态栏日志监听器
    useEventListener('status-bar-log', (msg) => {
        setMessage(msg);

        // 清除之前的定时器
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        // 清空消息
        timerRef.current = setTimeout(() => {
            setMessage("");
        }, 60000);
    });

    // ✅ 自动清理的进度监听器
    useEventListener('status-bar-percent', (progressPercent) => {
        setPercent(progressPercent);
    });

    // ✅ 任务队列监听器 - 项目中唯一的任务监听点
    useEffect(() => {
        let unlisten: (() => void) | undefined;

        const setupTaskListener = async () => {
            unlisten = await taskQueueAPI.onTaskUpdated((task) => {
                // 更新进度条
                emitEvent("status-bar-percent", task.progress).catch(console.error);

                // 根据任务状态更新消息
                if (task.status === 'processing') {
                    const taskName = task.type || 'Task';
                    setMessage(`${t("Processing")}: ${taskName} (${task.progress}%)`);
                } else if (task.status === 'completed') {
                    setMessage(t("Task Completed"));
                    // 完成后清空进度条
                    emitEvent("status-bar-percent", 0).catch(console.error);
                } else if (task.status === 'failed') {
                    setMessage(`${t("Task Failed")}: ${task.error || 'Unknown error'}`);
                    // 失败后清空进度条
                    emitEvent("status-bar-percent", 0).catch(console.error);
                }
            });
        };

        setupTaskListener();

        return () => {
            if (unlisten) {
                unlisten();
            }
        };
    }, []);

    // 清理定时器
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, []);

    return (
        <Flex vertical={true} style={{ borderTop: "1px solid rgba(5, 5, 5, 0.06)" }}>
            <Progress
                strokeColor={ProgressColors}
                showInfo={false}
                strokeWidth={1}
                percent={percent}
                style={{
                    width: "100%",
                    marginTop: -1,
                    border: 0,
                    padding: 0,
                    borderRadius: 0
                }}
            />
            <div style={{
                lineHeight: "30px",
                marginLeft: "10px",
                color: "#666"
            }}>
                {message}
            </div>
        </Flex>
    );
}

/**
 * 静态方法：发送日志消息到状态栏
 * 保留向后兼容的 API
 *
 * @example
 * await StatusBar.log("操作完成");
 */
StatusBar.log = async function(message: string) {
    await emitEvent('status-bar-log', message);
};

export default StatusBar;
