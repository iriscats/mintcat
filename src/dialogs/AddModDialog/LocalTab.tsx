import React, {useState} from "react";
import {open} from "@tauri-apps/plugin-dialog";
import {Form, Select} from "antd";
import {t} from "i18next";
import {InboxOutlined} from "@ant-design/icons";
import Dragger from "antd/es/upload/Dragger";

export const LocalTab = React.forwardRef(({groupId, groupOptions}: any, ref) => {

    const [path, setPath] = useState("");
    const [loading, setLoading] = useState(false);

    React.useImperativeHandle(ref, () => ({
        submit: async () => {
            setLoading(true);

            // const vm = await HomeViewModel.getInstance();
            // await vm.addModFromPath(path, groupId);

            setLoading(false);
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
            setPath(result);
        }
    }

    const onSelectGroupChange = (value: number) => {
        groupId = value
    }

    return (
        <Form layout="vertical"
              disabled={loading}
              initialValues={{
                  path: path,
                  groupId: groupId
              }}
        >
            <Form.Item name="groupId"
                       label={t("Group")}
                       rules={[{required: true}]}
            >
                <Select options={groupOptions}
                        onChange={onSelectGroupChange}
                />
            </Form.Item>
            <Form.Item name="path" label={t("Path")}>
                <Dragger>
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

