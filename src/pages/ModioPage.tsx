import React from 'react';
import {Avatar, Button, Divider, Flex, List, message, Skeleton, Space} from 'antd';
import {DownloadOutlined, LikeOutlined, PlusCircleOutlined} from '@ant-design/icons';
import InfiniteScroll from 'react-infinite-scroll-component';
import Search from "antd/es/input/Search";
import ModioApi from "../apis/ModioApi.ts";
import {ModInfo} from "../vm/modio/ModInfo.ts";
import AddModDialog from "../dialogs/AddModDialog.tsx";


const IconText = ({icon, text}: { icon: React.FC; text: string }) => (
    <Space>
        {React.createElement(icon)}
        {text}
    </Space>
);

interface ModioPageState {
    dataSource?: ModInfo[],
    loading: boolean,
}

class ModioPage extends React.Component<any, ModioPageState> {

    private readonly addModDialogRef: React.RefObject<AddModDialog> = React.createRef();

    public constructor(props: any, context: ModioPageState) {
        super(props, context);

        this.state = {
            dataSource: [],
            loading: true,
        }

        this.onAddClick = this.onAddClick.bind(this);
        this.onSearch = this.onSearch.bind(this);
    }

    private async onSearch(value: string) {
        this.setState({
            loading: true,
        });
        const list = await ModioApi.getModList(value);
        this.setState({
            dataSource: list,
            loading: false,
        });
    }

    private onAddClick(url: string) {
        this.addModDialogRef.current?.setValue(0, url)
            .setCallback(async () => {
                await message.info("Add Successfully");
            }).show();
    }

    componentDidMount() {
        if (this.state.dataSource.length == 0) {
            ModioApi.getModList().then((list: any[]) => {
                this.setState({
                    dataSource: list,
                    loading: false,
                })
            });
        }
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
                <AddModDialog ref={this.addModDialogRef}/>

                <Flex vertical={true}>
                    <Search placeholder="Search on mod.io" onSearch={this.onSearch}/>
                    <InfiniteScroll
                        scrollableTarget="scrollableDiv"
                        dataLength={this.state.dataSource.length}
                        hasMore={true}
                        loader={null}
                        endMessage={null}
                        next={() => {
                            console.log('next');
                        }}
                    >
                        <List
                            itemLayout="vertical"
                            dataSource={this.state.dataSource}
                            size={"small"}
                            loading={this.state.loading}
                            renderItem={(item) => (
                                <List.Item
                                    key={item.name}
                                    onDoubleClick={() => {

                                    }}
                                    actions={[
                                        <IconText icon={DownloadOutlined}
                                                  text={item.stats.downloads_total.toString()}/>,
                                        <IconText icon={LikeOutlined}
                                                  text={item.stats.subscribers_total.toString()}/>,

                                    ]}
                                    extra={
                                        <img
                                            width={180}
                                            style={{border: '1px solid #eee'}}
                                            alt="logo"
                                            src={"https://api.v1st.net/" + item.logo.thumb_320x180}
                                        />
                                    }
                                >
                                    <List.Item.Meta
                                        avatar={
                                            <Avatar style={{width: '60px', height: '60px', marginTop: '4px'}}
                                                    src={"https://api.v1st.net/" + item.submitted_by.avatar.thumb_50x50}
                                            />
                                        }
                                        title={
                                            <>
                                                <a href={item.name_id}>{item.name}</a>
                                                <Button type={"text"}
                                                        onClick={() => {
                                                            console.log(item)
                                                            this.onAddClick(item.profile_url)
                                                        }}>
                                                    <PlusCircleOutlined/>
                                                </Button>
                                            </>
                                        }
                                        description={item.summary}
                                    />

                                </List.Item>
                            )}
                        />
                    </InfiniteScroll>
                </Flex>
            </div>
        );
    }


}

export default ModioPage;