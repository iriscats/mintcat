import React from "react";

interface CountLabelProps {
    enableCount: number;
    totalCount: number;
}

export const CountLabel = ({ enableCount, totalCount }: CountLabelProps) => {
    return (
        <span style={{
            display: 'flex',
            alignItems: 'center',
            color: '#888',
            marginRight: '20px',
        }}>
            {enableCount} / {totalCount}
        </span>
    )
}
