import React from "react";
import {t} from "i18next";
import {Button, Flex, Progress, ProgressProps} from "antd";
import {emit, listen} from "@tauri-apps/api/event";
import {CloseCircleOutlined, CloseOutlined} from "@ant-design/icons";


const ProgressColors: ProgressProps['strokeColor'] = {
    '0%': '#108ee9',
    '100%': '#87d068',
};


interface StatusBarState {
    message?: string;
    percent?: number;
}


class StatusBar extends React.Component<any, StatusBarState> {

    private isHook = false;
    private timer = undefined;

    public constructor(props: any, state: StatusBarState) {
        super(props, state);

        this.state = {
            message: t("Ready"),
            percent: 0,
        }

        this.onProgress = this.onProgress.bind(this);
        this.onLogMessage = this.onLogMessage.bind(this);
    }

    public onLogMessage(message: string) {
        this.setState({
            message: message
        });

        const new_timer = setTimeout(() => {
            this.timer = 0;
            this.setState({
                message: ""
            })
        }, 30000);

        if (this.timer !== 0) {
            clearTimeout(this.timer);
        }
        this.timer = new_timer;
    }

    public onProgress(percent: number) {
        this.setState({
            percent: percent
        })
    }

    private registerListeners() {
        try {
            if (this.isHook) {
                return;
            }
            this.isHook = true;

            listen<string>('status-bar-log', (event) => {
                this.onLogMessage(event.payload);
            });

            listen<number>('status-bar-percent', (event) => {
                this.onProgress(event.payload);
            });
        } catch (e) {
        }
    }

    componentDidMount() {
        this.registerListeners();
    }

    render() {
        return (
            <Flex vertical={true} style={{borderTop: "1px solid rgba(5, 5, 5, 0.06)"}}>
                <Progress strokeColor={ProgressColors}
                          showInfo={false}
                          size={"small"}
                          percent={this.state.percent}
                          style={{
                              width: "100%",
                              marginTop: -4,
                              border: 0,
                              padding: 0,
                              borderRadius: 0
                          }}/>
                <div style={{
                    lineHeight: "30px",
                    marginLeft: "10px",
                    color: "#666"
                }}>
                    {
                        this.state.message &&
                        <Button title={t("Cancel")}
                                icon={<CloseCircleOutlined/>}
                                type={"link"}
                                onClick={async () => {
                                    await emit("home-page-loading", false);
                                    this.setState({
                                        message: ""
                                    })
                                }}
                        />
                    }
                    {this.state.message}
                </div>
            </Flex>
        );
    }
}

export default StatusBar;