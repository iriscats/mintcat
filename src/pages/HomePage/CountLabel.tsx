import React from "react";

interface CountLabelProps {
    enableCount: number;
    totalCount: number;
}

export const CountLabel = ({ enableCount, totalCount }: CountLabelProps) => {
    return (
        <span className="count-label">
            {enableCount} / {totalCount}
        </span>
    )
}
