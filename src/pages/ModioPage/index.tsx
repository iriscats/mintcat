import React from 'react';
import {t} from "i18next";
import {Avatar, Button, Dropdown, Flex, List, MenuProps, message, Skeleton, Space} from 'antd';
import {DownloadOutlined, HomeOutlined, LikeOutlined, PlusCircleOutlined} from '@ant-design/icons';
import InfiniteScroll from 'react-infinite-scroll-component';
import Search from "antd/es/input/Search";
import {open} from "@tauri-apps/plugin-shell";
import {ModioApi} from "@/apis/ModioApi.ts";
import {ModInfo} from "@/vm/modio/ModInfo.ts";
import {TranslateApi} from "@/apis/TranslateApi.ts";
import {CacheApi} from "@/apis/CacheApi.ts";
import {ProfileTreeGroupType} from "@/vm/config/ProfileList.ts";
import {BasePage} from "../IBasePage.ts";
import {AddModType} from "@/dialogs/AddModDialog";
import {openWindow} from "@/dialogs/AddModDialog/open.ts";


const IconText = ({icon, text}: { icon: React.FC; text: string }) => (
    <Space>
        {React.createElement(icon)}
        {text}
    </Space>
);

const contextMenus: MenuProps['items'] = [
    {label: t("Translate Into Current Language"), key: 'translate'},
    {label: t("Restore"), key: 'restore'},
];

interface ModioPageState {
    dataSource?: ModInfo[],
    loading: boolean,
    disable: boolean,
    hasMore: boolean,
}

export class ModioPage extends BasePage<any, ModioPageState> {

    private readonly addModDialogRef = React.createRef();
    private pageSize: number = 50;
    private pageNo: number = 0;

    public constructor(props: any, context: ModioPageState) {
        super(props, context);

        this.state = {
            dataSource: [],
            loading: false,
            disable: true,
            hasMore: false
        }

        this.onAddClick = this.onAddClick.bind(this);
        this.onSearch = this.onSearch.bind(this);
        this.onMenuClick = this.onMenuClick.bind(this);
        this.loadModList = this.loadModList.bind(this);
    }

    private async onSearch(value: string) {
        this.setState({
            loading: true,
            disable: true,
        });
        const dataSource = await ModioApi.getModList(this.pageNo, this.pageSize, value);
        this.setState({
            dataSource: dataSource,
            loading: false,
            disable: false,
            hasMore: dataSource.length === this.pageSize,
        });
    }

    private onAddClick(url: string) {
        openWindow(AddModType.MODIO, ProfileTreeGroupType.MODIO, url).then();

        // this.addModDialogRef.current?.setValue(ProfileTreeGroupType.MODIO, url)
        //     .setCallback(async () => {
        //         await message.info(t("Add Successfully"));
        //     }).show();
    }

    private async onMenuClick(key: string, item: ModInfo) {
        switch (key) {
            case 'translate': {
                let foundItem = this.state.dataSource.find((mod) => {
                    return mod.name === item.name;
                });
                foundItem.name_trans = await TranslateApi.translate(item.name);
                foundItem.summary_trans = await TranslateApi.translate(item.summary);
                this.setState({
                    dataSource: this.state.dataSource,
                })
            }
                break;
            case 'restore': {
                let foundItem = this.state.dataSource.find((mod) => {
                    return mod.name === item.name;
                });
                foundItem.name_trans = undefined;
                foundItem.summary_trans = undefined;
                this.setState({
                    dataSource: this.state.dataSource,
                })
            }
                break;
            default:
                break;
        }
    }

    private async loadModList() {
        if (this.state.loading) {
            return;
        }
        this.setState({
            loading: true,
            disable: true,
        });
        const list = await ModioApi.getModList(this.pageNo, this.pageSize);
        this.setState({
            loading: false,
        });
        const dataSource = this.state.dataSource;
        for (let item of list) {
            item.logo.thumb_320x180 = await CacheApi.cacheImage(item.logo.thumb_320x180);
            item.submitted_by.avatar.thumb_50x50 = await CacheApi.cacheImage(item.submitted_by.avatar.thumb_50x50);
            dataSource.push(item);
            this.setState({
                dataSource: dataSource,
            })
        }
        this.setState({
            disable: false,
            hasMore: dataSource.length === this.pageSize,
        });
    }

    componentDidMount() {
        this.hookWindowResized();

        this.loadModList().then(_ => {
        })
    }

    render() {
        return (
            <div id="scrollableDiv"
                 style={{
                     height: window.innerHeight - 81,
                     overflow: 'auto',
                     backgroundColor: '#fff',
                     padding: '10px',
                 }}
            >

                <Flex vertical={true}>
                    <Flex>
                        <Button type={"text"}
                                icon={<HomeOutlined/>}
                                disabled={this.state.disable}
                                onClick={async () => {
                                    this.pageNo = 0;
                                    await this.onSearch("");
                                }}/>
                        <Search placeholder={t("Search on mod.io")}
                                onSearch={this.onSearch}
                                disabled={this.state.disable}
                        />
                    </Flex>
                    <InfiniteScroll
                        scrollableTarget="scrollableDiv"
                        dataLength={this.state.dataSource?.length}
                        hasMore={this.state.hasMore}
                        loader={
                            this.state.hasMore &&
                            <Skeleton avatar
                                      paragraph={{rows: 2}}
                            />
                        }
                        endMessage={null}
                        next={async () => {
                            this.pageNo++;
                            await this.loadModList();
                        }}
                    >
                        <List
                            itemLayout="vertical"
                            dataSource={this.state.dataSource}
                            size={"small"}
                            loading={this.state.loading}
                            renderItem={(item) => (
                                <Dropdown trigger={['contextMenu']}
                                          menu={{
                                              items: contextMenus,
                                              onClick: async (e) => {
                                                  await this.onMenuClick(e.key, item);
                                              }
                                          }}>
                                    <List.Item
                                        key={item.name}
                                        actions={[
                                            <IconText icon={DownloadOutlined}
                                                      text={item.stats.downloads_total.toString()}/>,
                                            <IconText icon={LikeOutlined}
                                                      text={item.stats.subscribers_total.toString()}/>
                                        ]}
                                        extra={
                                            <img
                                                width={180}
                                                style={{border: '1px solid #eee'}}
                                                alt="logo"
                                                src={item.logo.thumb_320x180}
                                            />
                                        }
                                    >
                                        <List.Item.Meta
                                            avatar={
                                                <Avatar style={{width: '60px', height: '60px', marginTop: '4px'}}
                                                        src={item.submitted_by.avatar.thumb_50x50}
                                                />
                                            }
                                            title={
                                                <>
                                                    <a onClick={async () => await open(item.profile_url)}>
                                                        {
                                                            item.name_trans ? item.name_trans : item.name
                                                        }
                                                    </a>
                                                    <Button type={"text"}
                                                            onClick={() => {
                                                                this.onAddClick(item.profile_url)
                                                            }}>
                                                        <PlusCircleOutlined/>
                                                    </Button>
                                                </>
                                            }
                                            description={
                                                item.summary_trans ? item.summary_trans : item.summary
                                            }
                                        />
                                    </List.Item>
                                </Dropdown>
                            )}
                        />
                    </InfiniteScroll>
                </Flex>
            </div>
        );
    }


}
