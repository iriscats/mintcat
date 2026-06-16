import React, {useState, useEffect} from "react";
import {Flex, Form} from "antd";
import {t} from "i18next";
import TextArea from "antd/es/input/TextArea";

export const OnlineTab = React.forwardRef(({text}: any, ref) => {

    const [url, setUrl] = useState<string>(text);

    // 当 text prop 变化时更新 url state
    useEffect(() => {
        if (text !== undefined) {
            setUrl(text);
        }
    }, [text]);

    React.useImperativeHandle(ref, () => ({
        submit: () => {
            const result: string[] = [];
            if (!url) {
                return result;
            }

            const mods = url.trim();
            const list = mods.split("\n");
            for (const item of list) {
                const trimmedItem = item.trim();
                if (trimmedItem && result.indexOf(trimmedItem) === -1) {
                    result.push(trimmedItem);
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
                              placeholder="https://mod.io/g/drg/m/xxx&#10;https://www.nexusmods.com/xxxx/mods/1&#10;https://modcat.top/#/modDetail?ModId=xxx&#10;"
                              rows={6}
                    />
                </Flex>
            </Form.Item>
        </Form>
    )
});
