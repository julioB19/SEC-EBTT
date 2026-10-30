import { describe, expect, jest, test, beforeEach } from "@jest/globals"
import { prisma } from "../../../src/infra/prismaClient"
import { assertSignedDecisionDocuments, assertTitularReady, validateNominees, CaseComplianceService } from "../../../src/service/caseComplianceService"

jest.mock("../../../src/infra/prismaClient", () => ({ prisma: { signedProcessArtifact: { findMany: jest.fn() }, careerProcess: { findUnique: jest.fn(), findFirst: jest.fn() } } }))
function nominees() {
  return Array.from({length:7},(_,i)=>({ name:`Indicado ${i}`,email:`indicado${i}@instituicao.edu.br`,phone:"55999999999",origin:i<5?"EXTERNAL":"INTERNAL",membership:i<3||i===5?"PRIMARY":"SUBSTITUTE",doctorateTitle:"Doutor em Educação",institution:"Instituição Federal",federalInstitution:true,careerLevel:"C4",knowledgeArea:"Educação",sameKnowledgeArea:true,priorConsentAt:"2026-01-01" }))
}
const signed = () => [...[1,2,3,4].map(memberId=>({documentKind:"INDIVIDUAL_OPINION",memberId,version:1,validatedAt:new Date(),rejectedAt:null,uploadedAt:new Date()})),{documentKind:"CONSOLIDATED_OPINION",memberId:null,version:1,validatedAt:new Date(),rejectedAt:null,uploadedAt:new Date()}]
beforeEach(()=>{jest.resetAllMocks()})
describe("Indicados e documentos que autorizam a decisão",()=>{
 test("aceita sete indicados com 3+2+1+1 e ciência prévia",()=>{expect(validateNominees(nominees())).toHaveLength(7)})
 test.each(["quantidade","origem","titularidade","doutorado","instituição","área","ciência","repetido","requerente"])("recusa indicação inválida: %s",kind=>{
  const values:any[]=nominees();let applicant:string|undefined
  if(kind==="quantidade")values.pop()
  if(kind==="origem")values[0].origin="INTERNAL"
  if(kind==="titularidade")values[0].membership="SUBSTITUTE"
  if(kind==="doutorado")values[0].doctorateTitle=""
  if(kind==="instituição")values[0].federalInstitution=false
  if(kind==="área"){values[0].sameKnowledgeArea=false;values[0].relatedAreaJustification=""}
  if(kind==="ciência")values[0].priorConsentAt="2099-01-01"
  if(kind==="repetido")values[1].email=values[0].email
  if(kind==="requerente")applicant=values[0].email
  expect(()=>validateNominees(values,applicant)).toThrow()
 })
 test("uma nova versão não validada invalida o uso da assinatura anterior",async()=>{
  const files=signed();(prisma.signedProcessArtifact.findMany as jest.Mock).mockResolvedValue([{...files[0],version:2,validatedAt:null},...files] as never)
  await expect(assertSignedDecisionDocuments(1,"RSC",{members:[1,2,3,4].map(idSpecialCommissionMember=>({idSpecialCommissionMember}))})).rejects.toThrow("pareceres")
 })
 test("valida os quatro pareceres e a consolidação, mas Titular também exige o presidente",async()=>{
  (prisma.signedProcessArtifact.findMany as jest.Mock).mockResolvedValue(signed() as never)
  const commission={members:[1,2,3,4].map(idSpecialCommissionMember=>({idSpecialCommissionMember}))}
  await expect(assertSignedDecisionDocuments(1,"RSC",commission)).resolves.toBeUndefined()
  await expect(assertSignedDecisionDocuments(1,"FULL_PROFESSOR",commission)).rejects.toThrow("presidente")
 })
 test("Titular não pode seguir sem desempenho, indicação e validação pela CPPD",async()=>{
  const process:any={fullProfessorDetail:{evaluationMode:"MEMORIAL",doctorateDegree:{countryCode:"BR",evidenceFileId:1,degreeType:"DOCTORATE",teacherId:1}},nominees:nominees(),user:{email:"docente@iffarroupilha.edu.br",docente:{idDocente:1}},compliance:{performanceFileId:1,claimedPerformancePoints:120}}
  ;(prisma.careerProcess.findUnique as jest.Mock).mockResolvedValue(process as never)
  await expect(assertTitularReady(1,"SUBMIT")).resolves.toEqual(process)
  await expect(assertTitularReady(1,"ACTIVATE")).rejects.toThrow("CPPD")
  process.compliance={...process.compliance,performanceApprovedAt:new Date(),performancePoints:120,doctorateValidatedAt:new Date(),nomineesValidatedAt:new Date()}
  await expect(assertTitularReady(1,"ACTIVATE")).resolves.toEqual(process)
  process.fullProfessorDetail.doctorateDegree.countryCode="PT"
  await expect(assertTitularReady(1,"SUBMIT")).rejects.toThrow("reconhecimento")
 })
 test("avaliador sem aceite não acessa o processo e suas assinaturas",async()=>{
  (prisma.careerProcess.findFirst as jest.Mock).mockResolvedValue({idProcess:1,userId:1,specialCommissions:[{status:"ACTIVE",members:[{acceptanceStatus:"PENDING",person:{users:[{idUser:2,active:true}]}}]}]} as never)
  await expect(new CaseComplianceService().context(1,{userId:2,role:"EXTERNAL_EVALUATOR"})).rejects.toThrow("acesso")
 })
})
