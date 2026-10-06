"use client";
import { createContext,useContext } from 'react';
import { editorialDefaults } from '@/lib/editorial-defaults';
const CommercialContext=createContext<Record<string,string>>(editorialDefaults.commerce.fields);
export default function CommercialTextProvider({fields,children}:{fields:Record<string,string>;children:React.ReactNode}){return <CommercialContext.Provider value={fields}>{children}</CommercialContext.Provider>;}
export function useCommercialTexts(){return useContext(CommercialContext);}
export function CommercialText({field}:{field:string}){return <>{useCommercialTexts()[field]??''}</>;}
