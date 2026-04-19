import React from "react";
import {Select, SelectProps} from "antd";
import {SearchOutlined} from "@ant-design/icons";
import {useTranslation} from "react-i18next";
import {TreeViewConverter} from "@/pages/HomePage/TreeViewConverter.ts";

type FilterOptionGroup = NonNullable<SelectProps["options"]>;

const defaultFilterOptionDefinitions = [
    {
        labelKey: "Source",
        options: [
            {value: "source:Local", labelKey: "Local"},
            {value: "source:Modio", labelKey: "Modio"},
            {value: "source:modcat", labelKey: "ModCat"},
        ],
    },
    {
        labelKey: "Enabled",
        options: [
            {value: "enabled:true", labelKey: "Enable"},
            {value: "enabled:false", labelKey: "Disable"},
        ],
    },
    {
        labelKey: "Status",
        options: [
            {value: "Verified", labelKey: "Verified"},
            {value: "Approved", labelKey: "Approved"},
            {value: "Sandbox", labelKey: "Sandbox"},
        ],
    },
    {
        labelKey: "Tags",
        options: [
            {value: "RequiredByAll", labelKey: "RequiredByAll"},
            {value: "Optional", labelKey: "Optional"},
            {value: "Audio", labelKey: "Audio"},
            {value: "Framework", labelKey: "Framework"},
            {value: "Tools", labelKey: "Tools"},
            {value: "QoL", labelKey: "QoL"},
            {value: "Visual", labelKey: "Visual"},
            {value: "Gameplay", labelKey: "Gameplay"},
        ],
    },
] as const;

const filterValueLabelKeyMap = defaultFilterOptionDefinitions.reduce<Record<string, string>>(
    (map, group) => {
        group.options.forEach((option) => {
            map[option.value] = option.labelKey;
        });
        return map;
    },
    {All: "All"},
);

interface SearchBoxProps {
    onUpdateTreeView: () => void;
}

function getFilterLabel(value: string, t: (key: string) => unknown): string {
    const labelKey = filterValueLabelKeyMap[value];
    return labelKey ? String(t(labelKey)) : value;
}

function buildDefaultFilterOptions(t: (key: string) => unknown): FilterOptionGroup {
    return defaultFilterOptionDefinitions.map((group) => ({
        label: String(t(group.labelKey)),
        options: group.options.map((option) => ({
            value: option.value,
            label: String(t(option.labelKey)),
        })),
    }));
}

/** 从 filterList 中收集不在默认选项里的自定义项，用于构建 options */
function getCustomOptionsFromFilterList(
    filterList: string[] | undefined,
    t: (key: string) => unknown,
): FilterOptionGroup {
    if (!filterList?.length) return [];

    const defaultValues = new Set<string>();
    defaultFilterOptionDefinitions.forEach((group) => {
        group.options.forEach((option) => defaultValues.add(option.value));
    });

    return filterList
        .filter((value) => !defaultValues.has(value))
        .map((value) => ({value, label: getFilterLabel(value, t)}));
}

export const SearchBox = ({ onUpdateTreeView }: SearchBoxProps) => {
    const { t } = useTranslation();
    const [searchKeyword, setSearchKeyword] = React.useState("");
    const [searchValue, setSearchValue] = React.useState<string[] | undefined>(() => {
        const list = TreeViewConverter.filterList;
        return list?.length ? list : undefined;
    });

    const defaultFilterOptions = React.useMemo<FilterOptionGroup>(() => {
        return buildDefaultFilterOptions(t);
    }, [t]);

    const searchOptions = React.useMemo<FilterOptionGroup>(() => {
        const filterList = Array.from(new Set([
            ...(searchValue ?? []),
            ...(searchKeyword ? [searchKeyword] : []),
        ]));
        const customOptions = getCustomOptionsFromFilterList(filterList, t);
        return customOptions.length ? [...customOptions, ...defaultFilterOptions] : defaultFilterOptions;
    }, [defaultFilterOptions, searchKeyword, searchValue, t]);

    const onSearch = (newValue: string) => {
        setSearchKeyword(newValue);
        TreeViewConverter.filterList = newValue ? [newValue] : [];
        onUpdateTreeView();
    }

    const onSearchSelectChange = (value: string[]) => {
        const nextValue = value.length ? value : undefined;
        TreeViewConverter.filterList = nextValue ?? [];
        setSearchKeyword("");
        setSearchValue(nextValue);
        onUpdateTreeView();
    }

    const onBlur = () => {
        const filterList = TreeViewConverter.filterList;
        setSearchKeyword("");
        setSearchValue(filterList?.length ? filterList : undefined);
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
