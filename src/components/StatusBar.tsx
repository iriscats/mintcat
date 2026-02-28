import { useState, useRef, useEffect } from "react";
import { t } from "i18next";
import { Flex, Progress, ProgressProps, theme } from "antd";
import { emitEvent, useEventListener } from "@/events";
import { taskQueueAPI } from 'tauri-plugin-task-queue';

const ProgressColors: ProgressProps['strokeColor'] = {
    '0%': '#108ee9',
    '100%': '#87d068',
};

/**
 * 日志级别类型
 */
type LogLevel = 'info' | 'success' | 'warning' | 'error';

/**
 * 状态栏组件
 * 显示应用状态消息和进度条
 *
 * 集中管理任务队列监听，作为项目中唯一的任务监听点
 */
function StatusBar() {
    const { token } = theme.useToken();
    const [message, setMessage] = useState<string>(t("Ready"));
    const [logLevel, setLogLevel] = useState<LogLevel>('info');
    const [percent, setPercent] = useState<number>(0);
    const timerRef = useRef<NodeJS.Timeout | undefined>(undefined);

    /**
     * 获取日志级别对应的颜色
     */
    const getLogLevelColor = (level: LogLevel): string => {
        switch (level) {
            case 'info':
                return token.colorPrimary; // 使用主题主色
            case 'success':
                return '#52c41a'; // Ant Design green
            case 'warning':
                return '#faad14'; // Ant Design orange
            case 'error':
                return '#ff4d4f'; // Ant Design red
            default:
                return '#666'; // Default gray
        }
    };

    // ✅ 自动清理的状态栏日志监听器（支持 backend.* key 与 { key, ...params } 多语言）
    useEventListener('status-bar-log', (msg) => {
        let text: string;
        if (typeof msg === 'string') {
            text = (msg.startsWith('backend.') || msg.startsWith('error.')) ? t(msg) : msg;
        } else if (msg && typeof msg === 'object' && 'key' in msg && typeof (msg as { key: string }).key === 'string') {
            const { key, ...params } = msg as { key: string; [k: string]: unknown };
            text = t(key, params as Record<string, string>);
        } else {
            const raw = (msg as { message?: string })?.message ?? String(msg);
            text = (raw.startsWith('backend.') || raw.startsWith('error.')) ? t(raw) : raw;
        }
        setMessage(text);
        setLogLevel((msg && typeof msg === 'object' && 'level' in msg) ? ((msg as { level?: LogLevel }).level || 'info') : 'info');

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
                    // 优先显示最新的任务消息
                    if (task.messages && task.messages.length > 0) {
                        const latestMessage = task.messages[task.messages.length - 1];
                        setMessage(latestMessage.message);
                        // 将任务消息级别映射到日志级别
                        const levelMap: Record<string, LogLevel> = {
                            'info': 'info',
                            'warning': 'warning',
                            'error': 'error'
                        };
                        setLogLevel(levelMap[latestMessage.level] || 'info');
                    }
                    // 如果没有消息但有步骤信息，显示步骤名称
                    else if (task.current_step) {
                        setMessage(`${task.current_step.name} (${task.current_step.current}/${task.current_step.total})`);
                        setLogLevel('info');
                    }
                    // 否则显示通用消息
                    else {
                        const taskName = task.type || 'Task';
                        setMessage(`${t("Processing")}: ${taskName} (${task.progress}%)`);
                        setLogLevel('info');
                    }
                } else if (task.status === 'completed') {
                    // 完成后清空进度条
                    emitEvent("status-bar-percent", 0).catch(console.error);
                } else if (task.status === 'failed') {
                    // 失败后清空进度条
                    emitEvent("status-bar-percent", 0).catch(console.error);
                    emitEvent('status-bar-log', { message: task.error, level: 'error' });
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
        <Flex className="status-bar" vertical={true} style={{ borderTop: "1px solid rgba(2, 2, 2, 0.01)" }}>
            <Progress
                className="status-bar-progress"
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
            <div className="status-bar-message" style={{
                lineHeight: "30px",
                marginLeft: "10px",
                color: getLogLevelColor(logLevel)
            }}>
                {message}
            </div>
        </Flex>
    );
}

/**
 * 静态方法：发送日志消息到状态栏
 * 支持指定日志级别
 *
 * @example
 * await StatusBar.log("操作完成");
 * await StatusBar.log("操作完成", "success");
 */
StatusBar.log = async function(message: string, level?: LogLevel) {
    await emitEvent('status-bar-log', { message, level: level || 'info' });
};

/**
 * 静态方法：发送 info 级别日志
 */
StatusBar.info = async function(message: string) {
    await emitEvent('status-bar-log', { message, level: 'info' });
};

/**
 * 静态方法：发送 success 级别日志
 */
StatusBar.success = async function(message: string) {
    await emitEvent('status-bar-log', { message, level: 'success' });
};

/**
 * 静态方法：发送 warning 级别日志
 */
StatusBar.warning = async function(message: string) {
    await emitEvent('status-bar-log', { message, level: 'warning' });
};

/**
 * 静态方法：发送 error 级别日志
 */
StatusBar.error = async function(message: string) {
    await emitEvent('status-bar-log', { message, level: 'error' });
};

export default StatusBar;
