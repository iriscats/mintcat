import React from "react";


const ChatPage = () => {
    return (
        <div style={{
            height: window.innerHeight - 81,
            width: "100%",
            backgroundColor: "#fff"
        }}>
            <iframe src={"https://webim-h5.easemob.com/login"}
                    style={{
                        width: '100%',
                        height: '100%',
                        border: 0
                    }}
            />
        </div>
    );
};
export default ChatPage;
