import {Flex, Image, Progress, ProgressProps} from "antd";
import React from "react";


const twoColors: ProgressProps['strokeColor'] = {
    '0%': '#108ee9',
    '100%': '#87d068',
};


const StatusBar: React.FC = () => (
    <div>
        <Progress percent={0}
                  strokeColor={twoColors}
                  showInfo={false}
                  size={"small"}
                  style={{width: "100%"}}
        />
        <div style={{lineHeight: "28px", marginLeft: "10px", color: "#666"}}>

        </div>
    </div>
)

export default StatusBar;