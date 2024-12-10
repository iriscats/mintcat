import React from 'react';
import {Avatar, Card, Divider, List, Skeleton, Space} from 'antd';
import {LikeOutlined, MessageOutlined, StarOutlined} from '@ant-design/icons';
import InfiniteScroll from 'react-infinite-scroll-component';


const data = Array.from({length: 23}).map((_, i) => ({
    href: 'https://ant.design',
    title: `Mod Title ${i}`,
    avatar: `https://api.dicebear.com/7.x/miniavs/svg?seed=${i}`,
    description:
        'mod description',
    content:
        'mod content this is a very very very very very very very long description',
}));

const IconText = ({icon, text}: { icon: React.FC; text: string }) => (
    <Space>
        {React.createElement(icon)}
        {text}
    </Space>
);


const ModioPage: React.FC = () => (
    <Card>
        <div
            id="scrollableDiv"
            style={{
                height: 450,
                overflow: 'auto',
            }}
        >
            <InfiniteScroll
                dataLength={data.length}
                hasMore={data.length < 50}
                loader={<Skeleton avatar paragraph={{rows: 1}} active/>}
                endMessage={<Divider plain>It is all, nothing more 🤐</Divider>}
                scrollableTarget="scrollableDiv"
            >
                <List
                    itemLayout="vertical"
                    dataSource={data}
                    footer={
                        <div>
                            <b>ant design</b> footer part
                        </div>
                    }
                    renderItem={(item) => (
                        <List.Item
                            key={item.title}
                            actions={[
                                <IconText icon={StarOutlined} text="156" key="list-vertical-star-o"/>,
                                <IconText icon={LikeOutlined} text="156" key="list-vertical-like-o"/>,
                                <IconText icon={MessageOutlined} text="2" key="list-vertical-message"/>,
                            ]}
                            extra={
                                <img
                                    width={272}
                                    alt="logo"
                                    src="https://gw.alipayobjects.com/zos/rmsportal/mqaQswcyDLcXyDKnZfES.png"
                                />
                            }
                        >
                            <List.Item.Meta
                                avatar={<Avatar src={item.avatar}/>}
                                title={<a href={item.href}>{item.title}</a>}
                                description={item.description}
                            />
                            {item.content}
                        </List.Item>
                    )}
                />
            </InfiniteScroll>
        </div>
    </Card>
);

export default ModioPage;