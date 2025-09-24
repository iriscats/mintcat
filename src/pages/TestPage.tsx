import React, {useEffect} from "react";
import {StorageAPI} from "@/storage";
import * as console from "node:console";


const TestPage = () => {

    console.log('TestPage 组件加载...');

    const initDb = async () => {
        console.log('初始化数据库...');
        await StorageAPI.getInstance();
    }

    useEffect(() => {
        initDb().then();
    }, []);

    return (
        <div style={{
            height: window.innerHeight - 81,
            width: "100%",
            backgroundColor: "#fff"
        }}>
        </div>
    );
};
export default TestPage;
