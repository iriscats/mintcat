import React from "react";
import {Select, SelectProps} from "antd";
import {SearchOutlined} from "@ant-design/icons";
import {HomeViewModel} from "@/vm/HomeViewModel.ts";
import {TreeViewConverter} from "@/vm/converter/TreeViewConverter.ts";

const defaultFilterOptions: SelectProps['options'] = [
    {value: 'Verified', label: 'Verified'},
    {value: 'Approved', label: 'Approved'},
    {value: 'Sandbox', label: 'Sandbox'},
    {value: 'RequiredByAll', label: 'RequiredByAll'},
    {value: 'Optional', label: 'Optional'},
    {value: 'Audio', label: 'Audio'},
    {value: 'Framework', label: 'Framework'},
    {value: 'Tools', label: 'Tools'},
    {value: 'QoL', label: 'QoL'},
    {value: 'Visual', label: 'Visual'},
]

export const SearchBox = () => {

    const [searchValue, setSearchValue] = React.useState<string>(undefined);
    const [searchOptions, setSearchOptions] = React.useState<SelectProps['options']>(defaultFilterOptions);

    const onSearch = async (newValue: string) => {
        const vm = await HomeViewModel.getInstance();
        TreeViewConverter.filterList = [newValue];

        let searchOptions: SelectProps['options'] = [];
        if (newValue !== "") {
            searchOptions.push({value: newValue, label: newValue});
        }
        for (const option of defaultFilterOptions) {
            searchOptions.push(option);
        }

        setSearchOptions(searchOptions);

        await vm.updateUI();
    }

    const onSearchSelectChange = async (value: any) => {
        TreeViewConverter.filterList = value;
        setSearchValue(value);
        const vm = await HomeViewModel.getInstance();
        await vm.updateUI();
    }

    return (
        <Select size={"small"}
                value={searchValue}
                options={searchOptions}
                onSearch={onSearch}
                onChange={onSearchSelectChange}
                style={{width: "300px"}}
                suffixIcon={<SearchOutlined/>}
                filterOption={false}
                notFoundContent={null}
                defaultActiveFirstOption={false}
                showSearch={true}
                allowClear={true}
                mode={"multiple"}
        />
    )
}


