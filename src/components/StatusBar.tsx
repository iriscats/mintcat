import { useState, useRef, useEffect } from "react";
import { t } from "i18next";
import { Flex, Progress, ProgressProps } from "antd";
import { emitEvent, useEventListener } from "@/events";

const ProgressColors: ProgressProps['strokeColor'] = {
    '0%': '#108ee9',
    '100%': '#87d068',
};

/**
 * 状态栏组件
 * 显示应用状态消息和进度条
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

        // 30秒后清空消息
        timerRef.current = setTimeout(() => {
            setMessage("");
        }, 30000);
    });

    // ✅ 自动清理的进度监听器
    useEventListener('status-bar-percent', (progressPercent) => {
        setPercent(progressPercent);
    });

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
                size={"small"}
                percent={percent}
                style={{
                    width: "100%",
                    marginTop: -4,
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
