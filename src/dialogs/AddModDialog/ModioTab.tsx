import React, {useState} from "react";
import {Flex, Form} from "antd";
import {t} from "i18next";
import TextArea from "antd/es/input/TextArea";

export const ModioTab = React.forwardRef(({text}: any, ref) => {

    const [url, setUrl] = useState<string>(text);

    React.useImperativeHandle(ref, () => ({
        submit: () => {
            const result = [];
            if (!url) {
                return result;
            }

            const mods = url.trim();
            const list = mods.split("\n");
            for (const item of list) {
                if (result.indexOf(item) === -1) {
                    result.push(item);
                }
            }
            return result;
        }
    }));

    const onTextChange = (e) => {
        setUrl(e.target.value);
    }

    return (
        <Form layout="vertical">
            <Form.Item name="modLinks"
                       label={t("Mod Links")}
                       rules={[{required: true}]}
            >
                <Flex>
                    <TextArea value={url}
                              onChange={onTextChange}
                              rows={6}
                    />
                </Flex>
            </Form.Item>
        </Form>
    )
});
