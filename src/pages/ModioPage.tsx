import React from 'react';
import {Avatar, Card, Divider, List, Skeleton, Space} from 'antd';
import {DownloadOutlined, LikeOutlined, MessageOutlined, StarOutlined} from '@ant-design/icons';
import InfiniteScroll from 'react-infinite-scroll-component';
import Search from "antd/es/input/Search";
import ModioApi from "../apis/ModioApi.ts";
import {ModInfo} from "../models/ModInfo.ts";


const IconText = ({icon, text}: { icon: React.FC; text: string }) => (
    <Space>
        {React.createElement(icon)}
        {text}
    </Space>
);

interface ModioPageState {
    dataSource: ModInfo[]
}

class ModioPage extends React.Component<any, ModioPageState> {

    public constructor(props: any, context: ModioPageState) {
        super(props, context);

        this.state = {
            dataSource: []
        }
    }

    componentDidMount() {
        ModioApi.getModList().then((res: any) => {
            console.log(res.data);
            this.setState({
                dataSource: res.data
            })
        })
    }

    render() {
        return (
            <Card>
                <div
                    id="scrollableDiv"
                    style={{
                        height: 464,
                        overflow: 'auto',
                    }}
                >
                    <div style={{paddingBottom: '20px', paddingRight: '16px'}}>
                        <Search placeholder="Search"/>
                    </div>

                    <InfiniteScroll
                        dataLength={this.state.dataSource.length}
                        hasMore={this.state.dataSource.length < 100}
                        loader={<Skeleton avatar paragraph={{rows: 1}} active/>}
                        endMessage={<Divider plain>It is all, nothing more 🤐</Divider>}
                        scrollableTarget="scrollableDiv"
                        next={() => {
                            console.log('next');
                        }}
                    >
                        <List
                            itemLayout="vertical"
                            dataSource={this.state.dataSource}
                            size={"small"}
                            footer={
                                <div>
                                    <b>ant design</b> footer part
                                </div>
                            }
                            renderItem={(item) => (
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
                                            width={100}
                                            alt="logo"
                                            src={"https://api.v1st.net/" + item.logo.thumb_320x180}
                                        />
                                    }
                                >
                                    <List.Item.Meta
                                        avatar={<Avatar
                                            src={"https://api.v1st.net/" + item.submitted_by.avatar.thumb_50x50}/>}
                                        title={<a href={item.name_id}>{item.name}</a>}
                                        description={item.summary}
                                    />

                                </List.Item>
                            )}
                        />
                    </InfiniteScroll>

                </div>
            </Card>
        );
    }


}

export default ModioPage;