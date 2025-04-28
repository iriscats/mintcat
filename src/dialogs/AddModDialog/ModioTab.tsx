import React, {useState} from "react";
import {Flex, Form} from "antd";
import {t} from "i18next";
import TextArea from "antd/es/input/TextArea";

export const ModioTab = React.forwardRef(({text}: any, ref) => {

    const [url, setUrl] = useState(text);

    React.useImperativeHandle(ref, () => ({
        submit: async () => {

            const links = url.split("\n");
            for (const link of links) {
                //const success = await vm.addModFromUrl(link, groupId);
                // if (!success) {
                //     break;
                // }
            }

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
