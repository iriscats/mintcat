import React from "react";
import {Progress, ProgressProps} from "antd";


const ProgressColors: ProgressProps['strokeColor'] = {
    '0%': '#108ee9',
    '100%': '#87d068',
};


const StatusBar: React.FC = () => (
    <div>
        <Progress percent={0}
                  strokeColor={ProgressColors}
                  showInfo={false}
                  size={"small"}
                  style={{width: "100%"}}
        />
        <div style={{lineHeight: "28px", marginLeft: "10px", color: "#666"}}>
        </div>
    </div>
)

export default StatusBar;