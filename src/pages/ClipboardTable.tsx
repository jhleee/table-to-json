import React, { useState, ClipboardEvent, ChangeEvent } from "react";
import { HelpCircle, X } from "lucide-react";

interface TreeNode {
  [key: string]: any;
}

const ClipboardTable: React.FC = () => {
  const [tableData, setTableData] = useState<string[][]>([]);
  const [treeJson, setTreeJson] = useState<TreeNode[] | null>(null);
  const [emptyValueOption, setEmptyValueOption] = useState<
    "null" | "empty" | "omit"
  >("null");
  const [showInstructions, setShowInstructions] = useState(false);

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text");
    const rows = pastedText
      .split("\n")
      .map((row) =>
        row.split("\t").map((cell) => cell.replace(/\r/g, "").trim())
      );
    setTableData(rows);
    const jsonTree = convertToTreeJson(rows);
    setTreeJson(jsonTree);
  };

  const convertToTreeJson = (data: string[][]): TreeNode[] | null => {
    if (data.length < 2) return null;

    const headers = data[0];
    const result: TreeNode[] = [];
    const itemMap = new Map<string, TreeNode>();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      let item: TreeNode = {};
      let itemKey = "";

      headers.forEach((header, j) => {
        const value = row[j];
        if (value !== "" || emptyValueOption !== "omit") {
          const arrayMatch = header.match(/^(.+)\[\]\.?$/);
          if (arrayMatch) {
            const [, arrayName, subField] = arrayMatch;
            if (!item[arrayName]) item[arrayName] = [];
            if (subField) {
              // 배열 안에 객체로 처리
              const lastIndex = item[arrayName].length - 1;
              if (lastIndex === -1 || item[arrayName][lastIndex][subField]) {
                item[arrayName].push({ [subField]: value });
              } else {
                item[arrayName][lastIndex][subField] = value;
              }
            } else {
              setNestedValue(item, `${arrayName}[]`, value, true);
            }
          } else {
            setNestedValue(item, header, value, false);
          }
        }
        if (!header.includes(".") && !header.includes("[]")) {
          itemKey += value;
        }
      });

      if (itemMap.has(itemKey)) {
        item = mergeItems(itemMap.get(itemKey) as TreeNode, item);
      }
      itemMap.set(itemKey, item);
    }

    result.push(...itemMap.values());
    return result;
  };

  const setNestedValue = (
    obj: TreeNode,
    path: string,
    value: unknown,
    isArray: boolean
  ) => {
    const parts = path.split(/\.|\[|\]/).filter(Boolean);
    let current = obj;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLastPart = i === parts.length - 1;

      if (isLastPart) {
        if (value === "") {
          switch (emptyValueOption) {
            case "null":
              current[part] = null;
              break;
            case "empty":
              current[part] = "";
              break;
            case "omit":
              break;
            default:
              current[part] = null;
          }
        } else {
          if (isArray) {
            if (!Array.isArray(current[part])) {
              current[part] = [];
            }
            current[part].push(value);
          } else {
            current[part] = value;
          }
        }
      } else {
        if (parts[i + 1]?.includes("[]")) {
          if (!current[part]) {
            current[part] = [];
          }
          // 배열 안에 중첩 객체가 있는 경우
          if (
            current[part].length === 0 ||
            typeof current[part][current[part].length - 1] !== "object"
          ) {
            current[part].push({});
          }
          current = current[part][current[part].length - 1];
        } else {
          if (!current[part]) {
            current[part] = {};
          }
          current = current[part];
        }
      }
    }
  };

  const mergeItems = (target: TreeNode, source: TreeNode): TreeNode => {
    Object.keys(source).forEach((key) => {
      if (Array.isArray(target[key])) {
        if (Array.isArray(source[key])) {
          target[key] = [...target[key], ...source[key]];
        } else {
          target[key].push(source[key]);
        }
      } else if (typeof target[key] === "object" && target[key] !== null) {
        target[key] = mergeItems(target[key], source[key]);
      } else if (target[key] === undefined) {
        target[key] = source[key];
      }
    });
    return target;
  };

  const handleOptionChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEmptyValueOption(e.target.value as "null" | "empty" | "omit");
    if (tableData.length > 0) {
      const updatedJsonTree = convertToTreeJson(tableData);
      setTreeJson(updatedJsonTree);
    }
  };

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <div className="max-w-full mx-auto bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">
            클립보드 데이터 변환기
          </h2>
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold p-2 rounded-full"
          >
            <HelpCircle size={24} />
          </button>
        </div>

        {showInstructions && (
          <div className="mb-6 bg-blue-50 border-l-4 border-blue-500 p-4 rounded relative">
            <button
              onClick={() => setShowInstructions(false)}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
            >
              <X size={24} />
            </button>
            <h4 className="font-bold mb-2">사용 방법:</h4>
            <ol className="list-decimal list-inside">
              <li>스프레드시트에서 데이터를 복사합니다.</li>
              <li>아래 텍스트 영역에 붙여넣기(Ctrl+V 또는 ⌘+V)합니다.</li>
              <li>헤더에 `[]`가 포함된 열은 배열로 처리됩니다.</li>
              <li>
                예: `XX[]` 또는 `ABC[]명`과 같은 헤더는 배열로 변환됩니다.
              </li>
              <li>결과는 테이블과 JSON 형식으로 표시됩니다.</li>
              <li>
                예시:
                <div className="flex flex-col flex-wrap gap-1">
                  <pre className="text-xs p-1 border-dashed border rounded">
                    {`이름	나이	주소.도시	주소.우편번호	취미[]	가족[]이름	가족[]나이
김철수	30	서울	12345	축구	김아빠	60
김철수	30	서울	12345	농구	김엄마	55
김철수	30	서울	12345	독서	김동생	25
이영희	28	부산	67890	요리	이아빠	58
이영희	28	부산	67890	여행	이엄마	53
박민준	35	대전	54321	등산	박아내	32
박민준	35	대전	54321	낚시	박자녀	5`}
                  </pre>
                  <pre className="text-xs p-1 border-dashed border rounded">{`[
  {
    "이름": "김철수",
    "나이": "30",
    "주소": {
      "도시": "서울",
      "우편번호": "12345"
    },
    "취미": [
      "축구",
      "농구",
      "독서"
    ],
    "가족": [
      {
        "이름": "김아빠",
        "나이": "60"
      },
      {
        "이름": "김엄마",
        "나이": "55"
      },
      {
        "이름": "김동생",
        "나이": "25"
      }
    ]
  },
  ...
]`}</pre>
                </div>
              </li>
            </ol>
          </div>
        )}

        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2 text-gray-700">
            빈 값 처리 옵션
          </h3>
          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio"
                name="emptyValueOption"
                value="null"
                checked={emptyValueOption === "null"}
                onChange={handleOptionChange}
              />
              <span className="ml-2">null로 처리</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio"
                name="emptyValueOption"
                value="empty"
                checked={emptyValueOption === "empty"}
                onChange={handleOptionChange}
              />
              <span className="ml-2">빈 문자열("")로 처리</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio"
                name="emptyValueOption"
                value="omit"
                checked={emptyValueOption === "omit"}
                onChange={handleOptionChange}
              />
              <span className="ml-2">완전히 제거</span>
            </label>
          </div>
        </div>

        <textarea
          className="w-full p-3 border border-gray-300 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={4}
          onPaste={handlePaste}
          placeholder="여기에 스프레드시트 데이터를 붙여넣으세요 (Ctrl+V 또는 ⌘+V)"
        />

        {(tableData.length > 0 || treeJson) && (
          <div className="flex flex-col lg:flex-row lg:space-x-4 space-y-4 lg:space-y-0">
            {tableData.length > 0 && (
              <div className="lg:w-1/2 w-full">
                <h3 className="text-lg font-semibold mb-2 text-gray-700">
                  테이블 데이터
                </h3>
                <div
                  className="border border-gray-300 rounded overflow-auto"
                  style={{ maxHeight: "400px" }}
                >
                  <table className="w-full border-collapse">
                    <thead className="bg-gray-50">
                      <tr>
                        {tableData[0].map((header, index) => (
                          <th
                            key={index}
                            className="border-b border-gray-300 p-2 text-left text-sm font-medium text-gray-600"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.slice(1).map((row, rowIndex) => (
                        <tr
                          key={rowIndex}
                          className={
                            rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"
                          }
                        >
                          {row.map((cell, cellIndex) => (
                            <td
                              key={cellIndex}
                              className="border-b border-gray-300 p-2 text-sm text-gray-800"
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {treeJson && (
              <div className="lg:w-1/2 w-full">
                <h3 className="text-lg font-semibold mb-2 text-gray-700">
                  트리 JSON 데이터
                </h3>
                <pre
                  className="bg-gray-50 p-4 rounded overflow-auto text-sm"
                  style={{ maxHeight: "400px" }}
                >
                  {JSON.stringify(treeJson, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClipboardTable;
