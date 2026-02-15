import React, {useEffect, useState} from "react";
import {Button, Checkbox, List, message, Spin} from "antd";
import {t} from "i18next";
import {ModioApi} from "@/apis/modio";
import type {ModInfo} from "@/apis/modio/ModInfo.ts";
import {ReloadOutlined} from "@ant-design/icons";

const PAGE_SIZE = 100;

export const SubscribedTab = React.forwardRef((_: any, ref) => {
    const [loading, setLoading] = useState(false);
    const [mods, setMods] = useState<ModInfo[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    const loadSubscribed = async () => {
        setLoading(true);
        try {
            const list: ModInfo[] = [];
            let page = 0;
            let hasMore = true;
            while (hasMore) {
                const chunk = await ModioApi.getSubscribedMods(page, PAGE_SIZE);
                list.push(...chunk);
                hasMore = chunk.length >= PAGE_SIZE;
                page++;
            }
            setMods(list);
            setSelectedIds(new Set(list.map(m => m.id)));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSubscribed();
    }, []);

    React.useImperativeHandle(ref, () => ({
        submit: (): string[] => {
            return mods
                .filter(m => selectedIds.has(m.id))
                .map(m => m.profile_url);
        }
    }));

    const toggleOne = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAll = () => setSelectedIds(new Set(mods.map(m => m.id)));
    const deselectAll = () => setSelectedIds(new Set());

    if (loading && mods.length === 0) {
        return (
            <div style={{padding: 24, textAlign: "center"}}>
                <Spin size="large"/>
                <p style={{marginTop: 12}}>{t("Loading subscribed mods...")}</p>
            </div>
        );
    }

    if (!loading && mods.length === 0) {
        return (
            <div style={{padding: 24, textAlign: "center"}}>
                <p>{t("No subscribed mods. Please log in to mod.io and subscribe to mods first.")}</p>
                <Button type="primary" icon={<ReloadOutlined/>} onClick={loadSubscribed} style={{marginTop: 12}}>
                    {t("Retry")}
                </Button>
            </div>
        );
    }

    return (
        <div>
            <div style={{marginBottom: 12, display: "flex", gap: 8, alignItems: "center"}}>
                <Button size="small" onClick={selectAll}>{t("Select All")}</Button>
                <Button size="small" onClick={deselectAll}>{t("Deselect All")}</Button>
                <Button size="small" icon={<ReloadOutlined/>} onClick={loadSubscribed} loading={loading}>
                    {t("Refresh")}
                </Button>
                <span style={{color: "#666", fontSize: 12}}>
                    {t("Selected")}: {selectedIds.size} / {mods.length}
                </span>
            </div>
            <List
                size="small"
                dataSource={mods}
                style={{maxHeight: window.innerHeight - 380, overflow: "auto"}}
                renderItem={(item) => (
                    <List.Item>
                        <Checkbox
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggleOne(item.id)}
                        >
                            <span title={item.profile_url}>{item.name}</span>
                        </Checkbox>
                    </List.Item>
                )}
            />
        </div>
    );
});
