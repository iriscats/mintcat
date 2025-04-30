import React from 'react';
import {BasePage} from "@/pages/IBasePage.ts";


export class EmptyPage extends BasePage<any, any> {

    public constructor(props: any, context: any) {
        super(props, context);
    }

    componentDidMount(): void {
        this.hookWindowResized();
    }

    render() {
        return (
            <div
                id="scrollableDiv"
                style={{
                    height: window.innerHeight - 81,
                }}>
            </div>
        );
    }
}
