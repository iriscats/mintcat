import React, {useState, useImperativeHandle, forwardRef, useEffect} from 'react';
import {Button, Checkbox, Flex, List, message, Modal, Space, Tag} from 'antd';
import {t} from "i18next";
import {remove} from "@tauri-apps/plugin-fs";
import {CloseOutlined, FileOutlined, FolderOpenOutlined} from "@ant-design/icons";
import {ConfigDataType} from "@/apis/ConfigApi/DataType.ts";
import {ConfigApi} from "@/apis/ConfigApi.ts";
import {openPath} from "@tauri-apps/plugin-opener";
import {MessageBox} from "@/components/MessageBox.ts";
import {listen} from "@tauri-apps/api/event";


interface ListDataType extends ConfigDataType {
    checked?: boolean;
}


export const ConfigManageDialog = forwardRef((_props, ref) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [dataSource, setDataSource] = useState<ListDataType[]>([]);

    useImperativeHandle(ref, () => ({
        show: () => setIsModalOpen(true),
    }));

    const handleOk = async () => {
        const result = dataSource.find((data) => {
            if (data.checked) {
                return data;
            }
        });
        if (result) {
            if (result.version === "0.4.0") {
                setIsModalOpen(false);
                return;
            }
            await ConfigApi.importConfig(result);
            window.location.reload();
        } else {
            message.error(t("Please select a config"));
        }
    };

    const handleCancel = () => {
        setIsModalOpen(false);
    };

    const onOpenClick = async (path: string) => {
        await openPath(path);
    };

    const onDeleteClick = async (path: string) => {
        const confirmed = await MessageBox.confirm({
            title: t("Delete Config"),
            content: t("Are you sure to delete the configuration folder?"),
        });
        if (confirmed) {
            await remove(path, {recursive: true});
            getData().then();
        }
    };

    const onCheckedChange = (checked: boolean, item: ListDataType) => {
        const newDataSource = dataSource.map((data) => {
            if (data.path === item.path) {
                data.checked = checked;
            } else {
                data.checked = false;
            }
            return data;
        })
        setDataSource(newDataSource);
    }

    const getData = async () => {
        const configs = await ConfigApi.getExistingConfigList();
        setDataSource(configs);
    }


    listen("config-manage-dialog-open", async () => {
        setIsModalOpen(true);
    }).then();

    useEffect(() => {
        getData().then();
    }, []);

    return (
        <Modal
            title={t("Configuration Management")}
            open={isModalOpen}
            okText={t("Import Config")}
            cancelText={t("Import Cancel")}
            onOk={handleOk}
            onCancel={handleCancel}
            width={600}
        >
            <Space direction="vertical"
                   style={{
                       width: "100%",
                       height: "100%",
                   }}
            >
                <div>
                    {t("Detected the following configurations. Please select the configurations to import")}
                </div>
                <List size="small"
                      bordered={true}
                      dataSource={dataSource}
                      renderItem={(item: ListDataType) => (
                          <List.Item className={"app-config-manage-list-item"}>
                              <Flex justify={"space-between"}
                                    gap={"small"}
                                    style={{width: "100%"}}
                              >
                                  <Flex gap={"small"}>
                                      <Checkbox checked={item.checked}
                                                onChange={
                                                    (event) =>
                                                        onCheckedChange(event.target.checked, item)
                                                }/>
                                      <FileOutlined/>
                                      <span>
                                          {`${t("Saved at")}: ${item.saveTime}`}
                                      </span>
                                      <Tag color="blue"
                                           bordered={false}
                                           style={{
                                               height: "20px",
                                               marginTop: "5px",
                                           }}
                                      >
                                          {item.version}
                                      </Tag>
                                      {
                                          item.version === "0.4.0" &&
                                          <Tag color="green"
                                               bordered={false}
                                               style={{
                                                   height: "20px",
                                                   marginTop: "5px",
                                               }}
                                          >
                                              {t("Loaded")}
                                          </Tag>
                                      }
                                  </Flex>
                                  <Flex>
                                      <Button type={"text"}
                                              icon={<FolderOpenOutlined/>}
                                              onClick={async () => {
                                                  await onOpenClick(item.path);
                                              }}
                                      />
                                      <Button variant={"text"}
                                              color={"red"}
                                              icon={<CloseOutlined/>}
                                              onClick={async () => {
                                                  await onDeleteClick(item.path);
                                              }}
                                      />
                                  </Flex>
                              </Flex>
                          </List.Item>
                      )}
                />
            </Space>
        </Modal>
    );
});

