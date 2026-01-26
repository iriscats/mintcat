import {useState, useImperativeHandle, forwardRef, useEffect} from 'react';
import {Button, Checkbox, Flex, List, message, Modal, Space, Tag} from 'antd';
import {t} from "i18next";
import {CloseOutlined, FileOutlined, FolderOpenOutlined} from "@ant-design/icons";
import {ConfigDataType} from "@/storage/DataType.ts";
import {MessageBox} from "@/components/MessageBox.ts";
import {emitVoidEvent, useEventListener} from "@/events";
import {DialogConfigService} from "@/services/DialogConfigService.ts";


interface ListDataType extends ConfigDataType {
    checked?: boolean;
}

export class ConfigManageDialogViewModel {

    public static async open() {
        await emitVoidEvent("config-manage-dialog-open");
    }

}


export const ConfigManageDialog = forwardRef((_props, ref) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [dataSource, setDataSource] = useState<ListDataType[]>([]);
    const dialogConfigService = new DialogConfigService();

    useImperativeHandle(ref, () => ({
        show: () => setIsModalOpen(true),
    }));

    const handleOk = async () => {
        const result = dataSource.find((data) => {
            if (data.checked) {
                return data;
            }
        });
        if (!result) {
            message.error(t("Please select a config"));
            return;
        }

        const success = await dialogConfigService.importConfig(result);
        if (!success) {
            message.error(t("Import Failed"));
            return;
        }

        setIsModalOpen(false);
        window.location.reload();
    };

    const handleCancel = () => {
        setIsModalOpen(false);
    };

    const onOpenClick = async (path: string) => {
        await dialogConfigService.openPath(path);
    };

    const onDeleteClick = async (path: string) => {
        const confirmed = await MessageBox.confirm({
            title: t("Delete Config"),
            content: t("Are you sure to delete the configuration folder?"),
        });
        if (confirmed) {
            await dialogConfigService.deleteConfigPath(path);
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
        const configs = await dialogConfigService.getExistingConfigList();
        setDataSource(configs);
    }

    // ✅ 使用 useEventListener 自动管理监听器清理
    useEventListener("config-manage-dialog-open", () => {
        setIsModalOpen(true);
    });

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
            <Space orientation="vertical"
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
