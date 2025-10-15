from langchain_community.document_loaders import PyPDFLoader


FILE_PATH = "./doc-iq/documents/sow.pdf"
loader = PyPDFLoader(file_path = FILE_PATH)
docs = loader.load()
print(docs[0].page_content[:100])


# docs = []
# docs_lazy = loader.lazy_load()

# for doc in docs_lazy:
#     docs.append(doc)
# print(docs[0].page_content[:100])
# print(docs[0].metadata)