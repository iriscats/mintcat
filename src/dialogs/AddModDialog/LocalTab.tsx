import {open} from "@tauri-apps/plugin-dialog";
import {exists, stat} from "@tauri-apps/plugin-fs";
import {path} from "@tauri-apps/api";
import {invoke} from "@tauri-apps/api/core";
import {useEventListener} from "@/events";
import {getCurrentWindow} from "@tauri-apps/api/window";
import React, {useEffect, useState} from "react";
import {Button, Flex, Form, List} from "antd";
import {t} from "i18next";
import {CloseOutlined, FilePptOutlined, FileZipOutlined, FolderOutlined, FolderOpenOutlined, InboxOutlined} from "@ant-design/icons";


interface FileItem {
    name: string;
    path: string;
    type: string;  // "folder" | ".pak" | ".zip"
    isUnpackedMod?: boolean;  // true if folder is a valid unpacked mod directory
}

/**
 * Check if a directory is a valid unpacked mod directory
 * A valid unpacked mod directory contains a Content folder with uasset/uexp files
 */
async function isValidUnpackedMod(dirPath: string): Promise<boolean> {
    try {
        return await invoke<boolean>('is_valid_unpacked_mod', { path: dirPath });
    } catch (e) {
        console.error('Failed to check unpacked mod:', e);
        return false;
    }
}

async function makeFileItem(filePath: string): Promise<FileItem> {
    const fileInfo = await stat(filePath);
    const fileName = await path.basename(filePath);

    if (fileInfo.isDirectory) {
        // Check if it's a valid unpacked mod directory
        const isUnpacked = await isValidUnpackedMod(filePath);
        return {
            path: filePath,
            name: fileName,
            type: "folder",
            isUnpackedMod: isUnpacked
        };
    }

    return {
        path: filePath,
        name: fileName,
        type: await path.extname(filePath)
    };
}

export const LocalTab = React.forwardRef(({}: any, ref) => {

    const [fileList, setFileList] = useState<FileItem[]>([]);

    React.useImperativeHandle(ref, () => ({
        submit: () => {
            return fileList.map(file => file.path);
        }
    }));


    const addFileList = async (filePath: string) => {
        if (!(await exists(filePath))) {
            return;
        }

        const fileInfo = await stat(filePath);
        const fileItem = await makeFileItem(filePath);

        // Accept: .pak files, .zip files, or valid unpacked mod directories
        if (fileInfo.isDirectory) {
            // For directories, only accept if it's a valid unpacked mod
            if (!fileItem.isUnpackedMod) {
                return;
            }
        } else {
            // For files, only accept .pak or .zip
            if (!(filePath.endsWith(".zip") || filePath.endsWith(".pak"))) {
                return;
            }
        }

        setFileList(prevList => {
            if (prevList.find(file => file.path === filePath)) {
                return prevList;
            }
            return [...prevList, fileItem];
        });
    }

    const onSelectPathClick = async () => {
        const results = await open({
            directory: true,
            multiple: true,
        });

        if (results) {
            for (let result of results) {
                await addFileList(result);
            }
        }
    }

    const onSelectFileClick = async () => {
        const results = await open({
            filters: [{
                name: '*',
                extensions: ['pak', 'zip'],
            }],
            multiple: true,
        });

        if (results) {
            for (let result of results) {
                await addFileList(result);
            }
        }
    }

    const registerDragDropEvent = () => {
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

    // ✅ 使用 useEventListener 监听 Tauri 文件拖放事件
    useEventListener('tauri://file-drop', async (event) => {
        // EventRegistry 中的 payload 结构是 { paths, position }，没有 type 字段
        for (let path of event.paths) {
            await addFileList(path);
        }
    });

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
            <Flex gap={"small"}>
                <div className={"ant-upload-drag"}
                     style={{flex: 1}}
                     onClick={onSelectPathClick}
                >
                    <p className="app-drag-icon">
                        <FolderOutlined/>
                    </p>
                    <p className="app-drag-hint">
                        {t("Select Folder")}
                    </p>
                </div>
                <div className={"ant-upload-drag"}
                     style={{flex: 1}}
                     onClick={onSelectFileClick}
                >
                    <p className="app-drag-icon">
                        <InboxOutlined/>
                    </p>
                    <p className="app-drag-hint">
                        {t("Select File")}
                    </p>
                </div>
            </Flex>
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
                                              item.type === "folder" ? (
                                                  item.isUnpackedMod ? <FolderOpenOutlined style={{color: '#52c41a'}}/> : <FolderOutlined/>
                                              ) :
                                              item.type === ".pak" ? <FilePptOutlined/> : <FileZipOutlined/>
                                          }
                                          <span>
                                              {item.name}
                                              {item.isUnpackedMod && <span style={{color: '#52c41a', marginLeft: 8, fontSize: 12}}>(Unpacked)</span>}
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

