import React from "react";
import {Flex, Progress, ProgressProps} from "antd";


const ProgressColors: ProgressProps['strokeColor'] = {
    '0%': '#108ee9',
    '100%': '#87d068',
};


class StatusBar extends React.Component {


    render() {
        return (
            <Flex vertical={true} style={{borderTop: "1px solid rgba(5, 5, 5, 0.06)"}}>
                {/* <Progress percent={0}
                          strokeColor={ProgressColors}
                          showInfo={false}
                          size={"small"}
                          style={{width: "100%", margin: 0, border: 0, padding: 0, borderRadius: 0}}
                />*/}
                <div style={{lineHeight: "28px", marginLeft: "10px", color: "#666"}}>
                </div>
            </Flex>
        );
    }
}

export default StatusBar;