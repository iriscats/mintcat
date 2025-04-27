import React, {useState} from "react";
import {Form, Select} from "antd";
import {t} from "i18next";
import TextArea from "antd/es/input/TextArea";

export const ModioTab = React.forwardRef(({groupId, groupOptions}: any, ref) => {

    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);

    React.useImperativeHandle(ref, () => ({
        submit: async () => {
            setLoading(true);

            // const vm = await HomeViewModel.getInstance();
            // const links = url.split("\n");
            // for (const link of links) {
            //     const success = await vm.addModFromUrl(link, groupId);
            //     if (!success) {
            //         break;
            //     }
            // }
            // setLoading(false);
        }
    }));

    const onTextChange = (e) => {
        setUrl(e.target.value);
    }

    const onSelectGroupChange = (value: number) => {
        groupId = value
    }

    return (
        <Form layout="vertical"
              disabled={loading}
              initialValues={{
                  modLinks: url,
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
            <Form.Item name="modLinks"
                       label={t("Mod Links")}
                       rules={[{required: true}]}
            >
                <TextArea value={url}
                          onChange={onTextChange}
                          rows={6}
                />
            </Form.Item>
        </Form>
    )
});
