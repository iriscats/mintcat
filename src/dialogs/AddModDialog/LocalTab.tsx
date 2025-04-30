import React, {useEffect, useState} from "react";
import {open} from "@tauri-apps/plugin-dialog";
import {Button, Flex, Form, List} from "antd";
import {t} from "i18next";
import {CloseOutlined, FilePptOutlined, FileZipOutlined, InboxOutlined} from "@ant-design/icons";
import {getCurrentWindow} from "@tauri-apps/api/window";
import {path} from "@tauri-apps/api";

let isHook = false;

interface FileItem {
    name: string;
    path: string;
    type: string;
}

async function makeFileItem(filePath: string) {
    return {
        path: filePath,
        name: await path.basename(filePath),
        type: await path.extname(filePath)
    }
}

export const LocalTab = React.forwardRef(({}: any, ref) => {

    const [fileList, setFileList] = useState<FileItem[]>([]);

    React.useImperativeHandle(ref, () => ({
        submit: () => {
            return fileList.map(file => file.path);
        }
    }));


    const addFileList = async (path: string) => {
        if (!(path.endsWith(".zip") || path.endsWith(".pak")))
            return;

        const fileItem = await makeFileItem(path);
        setFileList(prevList => {
            if (prevList.find(file => file.path === path)) {
                return prevList;
            }
            return [...prevList, fileItem];
        });
    }

    const onSelectPathClick = async () => {
        const results = await open({
            filters: [{
                name: '*',
                extensions: ['pak', 'zip'],
            }],
            multiple: true,
        });

        for (let result of results) {
            await addFileList(result);
        }
    }

    const registerDragDropEvent = () => {
        if (isHook) {
            return;
        }
        isHook = true;
        getCurrentWindow().onDragDropEvent(
            async (event) => {
                if (event.payload.type === 'drop') {
                    for (let path of event.payload.paths) {
                        await addFileList(path);
                    }
                }
            }
        ).then();
    }

    const onDeleteClick = (item) => {
        setFileList(fileList.filter(file => file.path !== item.path));
    }

    useEffect(() => {
        registerDragDropEvent();
        return () => {
        }
    }, []);

    return (
        <Form layout="vertical">
            <div className={"ant-upload-drag"}
                 onClick={onSelectPathClick}
            >
                <p className="app-drag-icon">
                    <InboxOutlined/>
                </p>
                <p className="app-drag-hint">
                    {t("Click or drag file to this area")}
                </p>
            </div>
            <br/>
            <Form.Item label={`${t("Selected Files")} ${fileList.length}`}>
                <div className={"app-drag-list"}
                     style={{
                         height: window.innerHeight - 400,
                     }}>
                    <List size={"small"}
                          dataSource={fileList}
                          style={{
                              height: window.innerHeight - 400,
                          }}
                          renderItem={item => (
                              <List.Item className={"app-drag-list-item"}>
                                  <Flex justify={"space-between"}
                                        gap={"small"}
                                        style={{width: "100%"}}
                                  >
                                      <Flex gap={"small"}>
                                          {
                                              item.type === ".pak" ? <FilePptOutlined/> : <FileZipOutlined/>
                                          }
                                          <span className={"ml-2"}>
                                              {item.name}
                                          </span>
                                      </Flex>
                                      <Button variant={"text"}
                                              size={"small"}
                                              color={"red"}
                                              icon={<CloseOutlined/>}
                                              onClick={() => onDeleteClick(item)}
                                      />
                                  </Flex>
                              </List.Item>
                          )}
                    />
                </div>
            </Form.Item>
        </Form>
    )

});

