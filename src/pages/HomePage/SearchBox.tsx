import React from "react";
import {Select, SelectProps} from "antd";
import {SearchOutlined} from "@ant-design/icons";
import {TreeViewConverter} from "@/pages/HomePage/TreeViewConverter.ts";

const defaultFilterOptions: SelectProps['options'] = [
    {
        label: 'Source',
        options: [
            {value: 'source:Local', label: 'Local'},
            {value: 'source:Modio', label: 'Modio'},
        ]
    },
    {
        label: 'Status',
        options: [
            {value: 'Verified', label: 'Verified'},
            {value: 'Approved', label: 'Approved'},
            {value: 'Sandbox', label: 'Sandbox'},
        ]
    },
    {
        label: 'Tags',
        options: [
            {value: 'RequiredByAll', label: 'RequiredByAll'},
            {value: 'Optional', label: 'Optional'},
            {value: 'Audio', label: 'Audio'},
            {value: 'Framework', label: 'Framework'},
            {value: 'Tools', label: 'Tools'},
            {value: 'QoL', label: 'QoL'},
            {value: 'Visual', label: 'Visual'},
        ]
    },
]

interface SearchBoxProps {
    onUpdateTreeView: () => void;
}

/** 从 filterList 中收集不在默认选项里的自定义项，用于构建 options */
function getCustomOptionsFromFilterList(filterList: string[] | undefined): SelectProps['options'] {
    if (!filterList?.length) return [];
    const defaultValues = new Set<string>();
    defaultFilterOptions.forEach((g) => {
        (g as { options?: { value: string }[] }).options?.forEach((o) => defaultValues.add(o.value));
    });
    return filterList
        .filter((v) => !defaultValues.has(v))
        .map((value) => ({ value, label: value }));
}

export const SearchBox = ({ onUpdateTreeView }: SearchBoxProps) => {
    const [searchValue, setSearchValue] = React.useState<string[] | undefined>(() => {
        const list = TreeViewConverter.filterList;
        return list?.length ? list : undefined;
    });
    const [searchOptions, setSearchOptions] = React.useState<SelectProps['options']>(() => {
        const custom = getCustomOptionsFromFilterList(TreeViewConverter.filterList);
        return custom.length ? [...custom, ...defaultFilterOptions] : defaultFilterOptions;
    });

    const onSearch = async (newValue: string) => {
        TreeViewConverter.filterList = [newValue];

        let searchOptions: SelectProps['options'] = [];
        if (newValue !== "") {
            searchOptions.push({value: newValue, label: newValue});
        }
        for (const option of defaultFilterOptions) {
            searchOptions.push(option);
        }

        setSearchOptions(searchOptions);

        onUpdateTreeView();
    }

    const onSearchSelectChange = async (value: any) => {
        TreeViewConverter.filterList = value;
        setSearchValue(value);

        onUpdateTreeView();
    }

    const onBlur = async () => {
        setSearchValue(TreeViewConverter.filterList);
    }

    return (
        <Select size={"small"}
                value={searchValue}
                options={searchOptions}
                onChange={onSearchSelectChange}
                onBlur={onBlur}
                className="w-300"
                suffixIcon={<SearchOutlined/>}
                notFoundContent={null}
                defaultActiveFirstOption={false}
                showSearch={{ onSearch, filterOption: false }}
                allowClear={true}
                mode={"multiple"}
        />
    )
}
