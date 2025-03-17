import React from "react";
import {Flex, Progress, ProgressProps} from "antd";
import {listen} from "@tauri-apps/api/event";


const ProgressColors: ProgressProps['strokeColor'] = {
    '0%': '#108ee9',
    '100%': '#87d068',
};


interface StatusBarState {
    message?: string;
    percent?: number;
}


class StatusBar extends React.Component<any, StatusBarState> {

    public constructor(props: any, state: StatusBarState) {
        super(props, state);

        this.state = {
            message: "Ready",
            percent: 0,
        }

        this.onProgress = this.onProgress.bind(this);
        this.onLogMessage = this.onLogMessage.bind(this);
    }

    public onLogMessage(message: string) {
        this.setState({
            message: message
        })
    }

    public onProgress(percent: number) {
        this.setState({
            percent: percent
        })
    }

    componentDidMount() {
        listen<string>('status-bar-log', (event) => {
            this.onLogMessage(event.payload);
        });

        listen<number>('status-bar-percent', (event) => {
            this.onProgress(event.payload);
        });
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
                    {this.state.message}
                </div>
            </Flex>
        );
    }
}

export default StatusBar;