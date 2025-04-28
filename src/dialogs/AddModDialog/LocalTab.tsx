import React, {useEffect, useState} from "react";
import {open} from "@tauri-apps/plugin-dialog";
import {Form, Select, UploadFile} from "antd";
import {t} from "i18next";
import {InboxOutlined} from "@ant-design/icons";
import Dragger from "antd/es/upload/Dragger";
import {getCurrentWindow} from "@tauri-apps/api/window";

let isHook = false;

export const LocalTab = React.forwardRef(({}: any, ref) => {

    const [fileList, setFileList] = useState<UploadFile[]>([]);

    React.useImperativeHandle(ref, () => ({
        submit: async () => {

            // const vm = await HomeViewModel.getInstance();
            // await vm.addModFromPath(path, groupId);

        }
    }));

    const onSelectPathClick = async () => {
        const result = await open({
            filters: [{
                name: '*',
                extensions: ['pak', 'zip'],
            }],
            multiple: false,
        });
        if (result) {
            //setPath(result);
        }
    }


    const onDrop = (e) => {
        console.log('Dropped files', e.dataTransfer.files);
    }

    const registerDragDropEvent = () => {
        if (isHook) {
            return;
        }
        isHook = true;
        getCurrentWindow().onDragDropEvent(
            (event) => {
                if (event.payload.type === 'drop') {
                    console.log('User dropped', event.payload);
                    fileList.push({
                        uid: event.payload.paths[0],
                        name: event.payload.paths[0],
                    });
                    setFileList(fileList);
                }
            }
        ).then();
    }

    registerDragDropEvent();

    return (
        <Form layout="vertical">
            <Form.Item name="path" label={t("Path")}>
                <Dragger multiple={true}
                         fileList={fileList}
                         onDrop={onDrop}
                >
                    <p className="ant-upload-drag-icon">
                        <InboxOutlined/>
                    </p>
                    <p className="ant-upload-hint">
                        {t("Click or drag file to this area")}
                    </p>
                </Dragger>
            </Form.Item>
        </Form>
    )

});

