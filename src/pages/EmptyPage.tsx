import React from 'react';
import { BasePage } from "@/pages/IBasePage.ts";
import { Spin, Button, Typography } from "antd";
import { useTranslation } from "react-i18next";

const { Text } = Typography;

export interface EmptyPageProps {
    /** 初始化失败时传入，用于显示错误信息与重试 */
    initError?: Error | null;
    onRetry?: () => void;
}

const emptyPageHeight = { height: window.innerHeight - 81 };

function EmptyPageContent({ initError, onRetry }: EmptyPageProps) {
    const { t } = useTranslation();

    if (initError != null) {
        return (
            <div id="scrollableDiv" style={{ ...emptyPageHeight, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                <Text type="danger" style={{ marginBottom: 16, textAlign: 'center' }}>
                    {initError.message || t("Application initialization failed")}
                </Text>
                {onRetry && (
                    <Button type="primary" onClick={onRetry}>
                        {t("Retry")}
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div id="scrollableDiv" style={{ ...emptyPageHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spin size="large" tip={t("Loading")} />
        </div>
    );
}

export class EmptyPage extends BasePage<EmptyPageProps, unknown> {

    public constructor(props: EmptyPageProps) {
        super(props);
    }

    componentDidMount(): void {
        this.hookWindowResized();
    }

    render() {
        return (
            <div id="scrollableDiv" style={emptyPageHeight}>
                <EmptyPageContent initError={this.props.initError} onRetry={this.props.onRetry} />
            </div>
        );
    }
}
